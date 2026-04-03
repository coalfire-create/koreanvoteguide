import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import session from "express-session";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { registerSchema, loginSchema, phoneVerificationSchema, insertPostSchema, insertCommentSchema, insertReportSchema } from "@shared/schema";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import pgSession from "connect-pg-simple";
import { pool, db } from "./db";
import { fetchAssemblyData } from "./scheduler";
import { syncAll, syncLegislators, syncBills, syncVotes, fetchEnactedBillsFromApi, fetchBillMemberVotes, type MemberVote } from "./api-sync";
import { calculatePoliticianStance } from "./stance";
import { legislators, assemblyBills, assemblyVotes } from "@shared/schema";
import { scrapeNewsArticle, analyzeNewsWithAI } from "./api/news-analyzer";
import { eq, desc, inArray } from "drizzle-orm";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";

const isProduction = process.env.NODE_ENV === "production";

// ===== Rate Limiters =====
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 20,
  message: { error: "요청이 너무 많습니다. 15분 후 다시 시도해주세요." },
  standardHeaders: true,
  legacyHeaders: false,
});

const sendCodeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 3,
  message: { error: "인증번호 발송 횟수를 초과했습니다. 1분 후 다시 시도해주세요." },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 120,
  message: { error: "API 요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ===== 뉴스 캐시 (15분) =====
let newsCache: { items: NewsItem[]; grouped: NewsGroup[]; cachedAt: number } | null = null;
const NEWS_CACHE_TTL = 15 * 60 * 1000;

// ===== 표결 사전 로드 진행 상태 =====
let prefetchProgress = { total: 0, done: 0, running: false, completedAt: 0 };

// ===== 법안별 의원 표결 캐시 (12시간) =====
const billVotesCache = new Map<string, { votes: MemberVote[]; cachedAt: number }>();
const BILL_VOTES_CACHE_TTL = 12 * 60 * 60 * 1000;
const billVotesFetching = new Map<string, Promise<MemberVote[]>>();

// ===== 의원별 전체 표결 이력 캐시 (6시간) =====
interface LegislatorHistoryCache {
  votes: { billId: string; billName: string; voteResult: string }[];
  cachedAt: number;
}
const legislatorHistoryCache = new Map<string, LegislatorHistoryCache>();
const LEGISLATOR_HISTORY_CACHE_TTL = 6 * 60 * 60 * 1000;

// ===== 의원별 표결 역인덱스 (billId/billName 메타 포함) =====
interface LegislatorVoteEntry {
  billId: string;
  billName: string;
  voteResult: string;
}
const legislatorVotesIndex = new Map<string, LegislatorVoteEntry[]>();

function updateLegislatorVotesIndex(billId: string, billName: string, votes: MemberVote[]) {
  for (const v of votes) {
    const key = v.legislatorId || v.legislatorName;
    if (!key) continue;
    const existing = legislatorVotesIndex.get(key) ?? [];
    if (!existing.find((e) => e.billId === billId)) {
      existing.push({ billId, billName, voteResult: v.voteResult });
      legislatorVotesIndex.set(key, existing);
    }
  }
}

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sourceCode: string;
  thumbnail?: string;
}

interface NewsGroup {
  headline: string;
  articles: NewsItem[];
}

// 방송사별 색상 및 코드
const SOURCE_META: Record<string, { label: string; code: string; color: string }> = {
  "연합뉴스":  { label: "연합",  code: "yna",    color: "bg-red-100 text-red-700 border-red-200" },
  "KBS":      { label: "KBS",   code: "kbs",    color: "bg-blue-100 text-blue-700 border-blue-200" },
  "MBC":      { label: "MBC",   code: "mbc",    color: "bg-purple-100 text-purple-700 border-purple-200" },
  "SBS":      { label: "SBS",   code: "sbs",    color: "bg-pink-100 text-pink-700 border-pink-200" },
  "JTBC":     { label: "JTBC",  code: "jtbc",   color: "bg-orange-100 text-orange-700 border-orange-200" },
  "YTN":      { label: "YTN",   code: "ytn",    color: "bg-sky-100 text-sky-700 border-sky-200" },
  "한겨레":   { label: "한겨레", code: "hani",   color: "bg-green-100 text-green-700 border-green-200" },
  "경향신문": { label: "경향",   code: "khan",   color: "bg-teal-100 text-teal-700 border-teal-200" },
  "조선일보": { label: "조선",   code: "chosun", color: "bg-slate-100 text-slate-700 border-slate-200" },
  "중앙일보": { label: "중앙",   code: "joongang", color: "bg-amber-100 text-amber-700 border-amber-200" },
  "동아일보": { label: "동아",   code: "donga",  color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  "뉴스1":    { label: "뉴스1",  code: "news1",  color: "bg-rose-100 text-rose-700 border-rose-200" },
};

const RSS_FEEDS = [
  { url: "https://www.yna.co.kr/rss/politics.xml",                                                       source: "연합뉴스",  limit: 10 },
  { url: "https://news.kbs.co.kr/rss/rss.do?cId=02",                                                     source: "KBS",      limit: 10 },
  { url: "https://imnews.imbc.com/rss/politics.xml",                                                     source: "MBC",      limit: 10 },
  { url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=02&plink=RSSREADER",                   source: "SBS",      limit: 10 },
  { url: "https://news.jtbc.co.kr/rss/politics.xml",                                                     source: "JTBC",     limit: 10 },
  { url: "https://www.ytn.co.kr/_pn/0101_rss.xml",                                                       source: "YTN",      limit: 10 },
  { url: "https://www.hani.co.kr/rss/politics/",                                                          source: "한겨레",   limit: 8  },
  { url: "https://www.khan.co.kr/rss/rssdata/politic_news.xml",                                           source: "경향신문", limit: 8  },
  { url: "https://www.chosun.com/arc/outboundfeeds/rss/category/politics/?outputType=xml",               source: "조선일보", limit: 8  },
  { url: "https://rss.joins.com/joins_news_list.xml",                                                    source: "중앙일보", limit: 8  },
  { url: "https://rss.donga.com/politics.xml",                                                           source: "동아일보", limit: 8  },
  { url: "https://feeds.feedburner.com/news1Korea-politics",                                              source: "뉴스1",    limit: 8  },
];

function extractText(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (val.__cdata) return String(val.__cdata);
  if (val["#text"]) return String(val["#text"]);
  return String(val);
}

// 한국어 불용어
const KO_STOPWORDS = new Set([
  "은", "는", "이", "가", "을", "를", "의", "에", "에서", "로", "으로", "와", "과", "도", "만",
  "등", "및", "또", "위해", "대해", "있어", "통해", "하는", "되는", "위한", "대한", "이후",
  "이전", "지난", "오늘", "어제", "이날", "밝혀", "강조", "주장", "지적", "설명", "위원회",
  "국회", "에서", "한다", "했다", "있다", "있는", "하고", "하며", "이다", "라고", "이라고",
  "했다", "했으며", "했다고", "자신", "앞서", "관련", "해당", "내용", "사실", "나서", "발표",
]);

function extractKeywords(title: string): string[] {
  return title
    .replace(/[·…"'"'<>「」\[\]()【】《》\-_~!?,.:;]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !KO_STOPWORDS.has(w) && !/^\d+$/.test(w));
}

function groupNewsByTopic(items: NewsItem[]): NewsGroup[] {
  const itemKw = items.map((item) => ({
    item,
    kws: new Set(extractKeywords(item.title)),
  }));

  const assigned = new Set<number>();
  const groups: NewsGroup[] = [];

  for (let i = 0; i < itemKw.length; i++) {
    if (assigned.has(i)) continue;
    const group: NewsItem[] = [itemKw[i].item];
    const mergedKws = new Set(itemKw[i].kws);
    assigned.add(i);

    for (let j = i + 1; j < itemKw.length; j++) {
      if (assigned.has(j)) continue;
      const overlap = Array.from(itemKw[j].kws).filter((k) => mergedKws.has(k)).length;
      if (overlap >= 2) {
        group.push(itemKw[j].item);
        itemKw[j].kws.forEach((k) => mergedKws.add(k));
        assigned.add(j);
      }
    }

    // 2개 이상 방송사가 보도한 경우만 그룹으로 포함
    const uniqueSources = new Set(group.map((a) => a.source));
    if (uniqueSources.size >= 2) {
      // 가장 최신 기사를 헤드라인으로
      group.sort((a, b) => new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime());
      groups.push({ headline: group[0].title, articles: group });
    }
  }

  return groups.slice(0, 20);
}

async function fetchKoreanPoliticsNews(): Promise<{ items: NewsItem[]; grouped: NewsGroup[] }> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    cdataPropName: "__cdata",
  });
  const allItems: NewsItem[] = [];

  await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const res = await axios.get(feed.url, {
          timeout: 8000,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)" },
        });
        const parsed = parser.parse(res.data);
        const rawItems = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
        const feedItems = Array.isArray(rawItems) ? rawItems : [rawItems];
        const meta = SOURCE_META[feed.source] ?? { code: feed.source, color: "" };

        for (const item of feedItems.slice(0, feed.limit)) {
          const title = extractText(item.title);
          const link =
            typeof item.link === "string"
              ? item.link
              : extractText(item.link?.["@_href"]) || extractText(item.guid) || "";
          const pubDate = extractText(item.pubDate || item.updated || item.published || "");
          const thumbnail =
            item["media:content"]?.["@_url"] ||
            item["media:thumbnail"]?.["@_url"] ||
            item.enclosure?.["@_url"] ||
            "";
          if (title && link) {
            allItems.push({
              title: title.trim(),
              link,
              pubDate,
              source: feed.source,
              sourceCode: meta.code,
              thumbnail: typeof thumbnail === "string" ? thumbnail : "",
            });
          }
        }
        console.log(`[news] ${feed.source}: ${feedItems.length}건 수신`);
      } catch (err: any) {
        console.error(`[news] ${feed.source} RSS 오류:`, err.message);
      }
    })
  );

  // 최신순 정렬
  allItems.sort((a, b) => new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime());

  const grouped = groupNewsByTopic(allItems);
  console.log(`[news] 총 ${allItems.length}건, 그룹 ${grouped.length}건`);

  return { items: allItems.slice(0, 100), grouped };
}

const ANON_ADJECTIVES = [
  "정의로운", "깨어있는", "용감한", "현명한", "따뜻한",
  "단단한", "빛나는", "자유로운", "공정한", "성실한",
  "청렴한", "지혜로운", "당당한", "올곧은", "열정적인",
];
const ANON_NOUNS = [
  "올빼미", "시민", "여우", "독수리", "고래",
  "사자", "나무", "바다", "해바라기", "별",
  "펭귄", "수달", "다람쥐", "부엉이", "하늘",
];

function generateAnonNickname(): string {
  const adj = ANON_ADJECTIVES[Math.floor(Math.random() * ANON_ADJECTIVES.length)];
  const noun = ANON_NOUNS[Math.floor(Math.random() * ANON_NOUNS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${adj} ${noun} #${num}`;
}

const userNicknameCache = new Map<string, string>();

const searchClicks = new Map<string, { name: string; count: number; timestamps: number[] }>();

function recordSearchClick(memberId: string, memberName: string) {
  const now = Date.now();
  const cutoff = now - 3600000;
  const entry = searchClicks.get(memberId) || { name: memberName, count: 0, timestamps: [] };
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);
  entry.timestamps.push(now);
  entry.count = entry.timestamps.length;
  entry.name = memberName;
  searchClicks.set(memberId, entry);
}

function getTrendingMembers(limit = 5): { memberId: string; name: string; count: number }[] {
  const now = Date.now();
  const cutoff = now - 3600000;
  const results: { memberId: string; name: string; count: number }[] = [];
  Array.from(searchClicks.entries()).forEach(([memberId, entry]) => {
    entry.timestamps = entry.timestamps.filter((t: number) => t > cutoff);
    entry.count = entry.timestamps.length;
    if (entry.count > 0) {
      results.push({ memberId, name: entry.name, count: entry.count });
    }
  });
  return results.sort((a, b) => b.count - a.count).slice(0, limit);
}

function getOrCreateNickname(userId: string): string {
  if (!userNicknameCache.has(userId)) {
    userNicknameCache.set(userId, generateAnonNickname());
  }
  return userNicknameCache.get(userId)!;
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const buf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(Buffer.from(hashed, "hex"), buf);
}

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "로그인이 필요합니다" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "로그인이 필요합니다" });
  }
  const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean);
  if (adminIds.length > 0 && !adminIds.includes(req.session.userId)) {
    return res.status(403).json({ error: "관리자 권한이 필요합니다" });
  }
  next();
}

const OPEN_API_KEY = process.env.OPEN_ASSEMBLY_API_KEY || process.env.ASSEMBLY_API_KEY;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const PgStore = pgSession(session);

  if (isProduction && !process.env.SESSION_SECRET) {
    throw new Error("프로덕션 환경에서는 SESSION_SECRET 환경변수가 반드시 필요합니다.");
  }

  app.use(
    session({
      store: new PgStore({
        pool,
        createTableIfMissing: true,
        ttl: 7 * 24 * 60 * 60, // 7일 (초 단위)
      }),
      secret: process.env.SESSION_SECRET || "vote-with-reason-dev-secret-key",
      resave: false,
      saveUninitialized: false,
      name: "kvg.sid", // 기본 'connect.sid' 대신 고유한 이름
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "strict" : "lax",
      },
    })
  );

  // 일반 API에 rate limit 적용
  app.use("/api/", apiLimiter);

  app.post("/api/auth/send-code", sendCodeLimiter, async (req, res) => {
    try {
      const result = phoneVerificationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "올바른 휴대폰 번호를 입력하세요" });
      }

      const { phone } = result.data;
      const normalizedPhone = phone.replace(/-/g, "");

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

      await storage.createVerificationCode(normalizedPhone, code, expiresAt);

      // 프로덕션에서는 실제 SMS 발송 필요 (현재는 개발용 콘솔 출력)
      if (!isProduction) {
        console.log(`[dev] 인증번호 (${normalizedPhone}): ${code}`);
      }

      const response: Record<string, any> = {
        success: true,
        message: "인증번호가 발송되었습니다",
      };
      // 개발 환경에서만 코드 응답에 포함 (프로덕션 보안)
      if (!isProduction) {
        response.demoCode = code;
      }

      res.json(response);
    } catch (error) {
      console.error("Send code error:", error);
      res.status(500).json({ error: "인증번호 발송 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      const result = registerSchema.safeParse(req.body);
      if (!result.success) {
        const firstError = result.error.errors[0]?.message || "입력 정보를 확인해주세요";
        return res.status(400).json({ error: firstError });
      }

      const { username, password, name, phone, verificationCode } = result.data;
      const normalizedPhone = phone.replace(/-/g, "");

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "이미 사용 중인 아이디입니다" });
      }

      const existingPhone = await storage.getUserByPhone(normalizedPhone);
      if (existingPhone) {
        return res.status(400).json({ error: "이미 등록된 전화번호입니다" });
      }

      const codeRecord = await storage.getVerificationCode(normalizedPhone, verificationCode);
      if (!codeRecord) {
        return res.status(400).json({ error: "인증번호가 올바르지 않거나 만료되었습니다" });
      }

      await storage.markVerificationCodeUsed(codeRecord.id);

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        name,
        phone: normalizedPhone,
      });

      req.session.userId = user.id;

      res.json({
        success: true,
        user: { id: user.id, username: user.username, name: user.name },
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ error: "회원가입 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "아이디와 비밀번호를 입력하세요" });
      }

      const { username, password } = result.data;

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" });
      }

      const valid = await comparePasswords(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" });
      }

      req.session.userId = user.id;

      res.json({
        success: true,
        user: { id: user.id, username: user.username, name: user.name },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "로그인 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "사용자를 찾을 수 없습니다" });
    }

    const badges = await storage.getUserBadges(user.id);
    res.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        voteVerified: user.voteVerified,
        badges,
        postCount: user.postCount,
        favorites: user.favorites,
      },
    });
  });

  app.post("/api/auth/verify-vote", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      if (user.voteVerified) {
        return res.json({ success: true, alreadyVerified: true, message: "이미 투표 인증이 완료되었습니다" });
      }
      const updated = await storage.verifyVote(req.session.userId!);
      const badges = await storage.getUserBadges(updated.id);
      res.json({
        success: true,
        message: "투표 인증이 완료되었습니다! 🗳️ '투표인증' 배지가 부여되었습니다.",
        badges,
        voteVerified: true,
      });
    } catch (error) {
      res.status(500).json({ error: "투표 인증 중 오류가 발생했습니다" });
    }
  });

  app.patch("/api/auth/favorites", requireAuth, async (req, res) => {
    try {
      const { favorites } = req.body;
      if (!Array.isArray(favorites)) {
        return res.status(400).json({ error: "즐겨찾기 목록은 배열이어야 합니다" });
      }
      const user = await storage.updateUserFavorites(req.session.userId!, favorites);
      const badges = await storage.getUserBadges(user.id);
      res.json({
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          voteVerified: user.voteVerified,
          badges,
          postCount: user.postCount,
          favorites: user.favorites,
        },
      });
    } catch (error: any) {
      console.error("Update favorites error:", error);
      res.status(500).json({ error: "즐겨찾기 업데이트 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "로그아웃 중 오류가 발생했습니다" });
      }
      res.json({ success: true });
    });
  });

  app.post("/api/candidates/rate", requireAuth, (req, res) => {
    const { candidateId, rating } = req.body;
    if (!candidateId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "잘못된 요청입니다" });
    }
    res.json({ success: true, candidateId, rating });
  });

  app.get("/api/status", async (_req, res) => {
    try {
      const status = await storage.getSchedulerStatus();
      if (!status) {
        return res.json({
          lastRun: null,
          success: null,
          message: "스케줄러가 아직 실행되지 않았습니다",
          consecutiveFailures: 0,
        });
      }
      res.json({
        lastRun: status.lastRun,
        success: status.success,
        message: status.errorMessage || "정상",
        consecutiveFailures: status.consecutiveFailures,
      });
    } catch (error) {
      res.status(500).json({ error: "상태 조회 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/members", async (_req, res) => {
    try {
      // DB에 데이터가 있으면 우선 사용 (빠름)
      const dbRows = await db.select().from(legislators).orderBy(legislators.name);
      if (dbRows.length > 0) {
        return res.json({ source: "db", data: dbRows });
      }
      // DB 없으면 전체 페이지 API 조회
      const { syncLegislators: sync } = await import("./api-sync");
      await sync();
      const freshRows = await db.select().from(legislators).orderBy(legislators.name);
      return res.json({ source: "api", data: freshRows });
    } catch (error) {
      console.error("Members API fetch error:", error);
      res.json({ source: "mock", data: null });
    }
  });

  app.post("/api/members/:id/click", async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (id && name) {
      recordSearchClick(id, name);
    }
    res.json({ ok: true });
  });

  app.get("/api/members/trending", async (_req, res) => {
    res.json(getTrendingMembers(5));
  });

  app.get("/api/bills", async (_req, res) => {
    try {
      // DB에 데이터가 있으면 우선 사용
      const dbRows = await db.select().from(assemblyBills).orderBy(desc(assemblyBills.proposeDate)).limit(1000);
      if (dbRows.length > 0) {
        return res.json({ source: "db", data: dbRows });
      }
      // DB 없으면 전체 페이지 API 조회
      const { syncBills: sync } = await import("./api-sync");
      await sync();
      const freshRows = await db.select().from(assemblyBills).orderBy(desc(assemblyBills.proposeDate)).limit(1000);
      return res.json({ source: "api", data: freshRows });
    } catch (error) {
      console.error("Bills API fetch error:", error);
      res.json({ source: "mock", data: null });
    }
  });

  let enactedBillsCache: { data: any[]; fetchedAt: number } | null = null;
  const ENACTED_CACHE_TTL = 6 * 60 * 60 * 1000; // 6시간

  app.get("/api/bills/enacted", async (_req, res) => {
    try {
      if (enactedBillsCache && Date.now() - enactedBillsCache.fetchedAt < ENACTED_CACHE_TTL) {
        return res.json({ source: "cache", data: enactedBillsCache.data });
      }

      const dbRows = await db
        .select()
        .from(assemblyBills)
        .where(eq(assemblyBills.result, "가결"))
        .orderBy(desc(assemblyBills.proposeDate))
        .limit(500);

      if (dbRows.length >= 10) {
        enactedBillsCache = { data: dbRows, fetchedAt: Date.now() };
        return res.json({ source: "db", data: dbRows });
      }

      const apiRows = await fetchEnactedBillsFromApi(20);
      enactedBillsCache = { data: apiRows, fetchedAt: Date.now() };
      res.json({ source: "api", data: apiRows });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "통과된 법안 조회 오류" });
    }
  });

  app.get("/api/votes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const cached = await storage.getCachedData("votes");
      if (cached && cached.length > 0) {
        const memberVotes = cached.filter((v: any) => v.HG_NM === id || v.MONA_CD === id);
        return res.json({ source: "api", data: memberVotes });
      }
      return res.json({ source: "mock", data: null });
    } catch (error) {
      res.status(500).json({ error: "표결 데이터 조회 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/attendance", async (_req, res) => {
    try {
      // 캐시된 데이터 우선 사용
      const cached = await storage.getCachedData("attendance");
      if (cached && cached.length > 0) {
        return res.json({ source: "cache", data: cached });
      }
      // 캐시 없으면 전체 페이지 조회 (scheduler 로직 재사용)
      if (!OPEN_API_KEY) {
        return res.json({ source: "mock", data: null });
      }
      const allRows: any[] = [];
      let pIndex = 1;
      const PAGE_SIZE = 300;
      while (true) {
        const response = await axios.get("https://open.assembly.go.kr/portal/openapi/nekcaihpamofqktdn", {
          params: { Key: OPEN_API_KEY, Type: "json", pIndex, pSize: PAGE_SIZE, AGE: "22" },
          timeout: 15000,
        });
        const serviceData = response.data?.nekcaihpamofqktdn;
        const rows = serviceData?.[1]?.row;
        const pageRows = Array.isArray(rows) ? rows : [];
        allRows.push(...pageRows);
        const totalCount = parseInt(serviceData?.[0]?.head?.[0]?.list_total_count) || 0;
        if (allRows.length >= totalCount || pageRows.length < PAGE_SIZE) break;
        pIndex++;
        await new Promise((r) => setTimeout(r, 300));
      }
      if (allRows.length > 0) {
        return res.json({ source: "api", data: allRows });
      }
      return res.json({ source: "mock", data: null });
    } catch (error) {
      console.error("Attendance API fetch error:", error);
      res.json({ source: "mock", data: null });
    }
  });

  app.post("/api/refresh", requireAdmin, async (_req, res) => {
    try {
      const result = await fetchAssemblyData();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "수동 갱신 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/sync", requireAdmin, async (_req, res) => {
    try {
      const result = await syncAll();
      res.json({ ok: true, result });
    } catch (error: any) {
      res.status(500).json({ error: `동기화 실패: ${error.message}` });
    }
  });

  app.post("/api/sync/legislators", requireAdmin, async (_req, res) => {
    try {
      const result = await syncLegislators();
      res.json({ ok: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sync/bills", requireAdmin, async (_req, res) => {
    try {
      const result = await syncBills();
      res.json({ ok: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sync/votes", requireAdmin, async (_req, res) => {
    try {
      const result = await syncVotes();
      res.json({ ok: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/db/legislators", async (_req, res) => {
    try {
      const rows = await db.select().from(legislators).orderBy(legislators.name);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/db/bills", async (_req, res) => {
    try {
      const rows = await db.select().from(assemblyBills).orderBy(desc(assemblyBills.proposeDate));
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/db/bills/:billId", async (req, res) => {
    try {
      const rows = await db.select().from(assemblyBills).where(eq(assemblyBills.billId, req.params.billId as string));
      if (rows.length === 0) return res.status(404).json({ error: "법안을 찾을 수 없습니다" });
      res.json(rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/db/bills/:billId/votes", async (req, res) => {
    try {
      const rows = await db.select().from(assemblyVotes).where(eq(assemblyVotes.billId, req.params.billId));
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  function getBillNameFromCache(billId: string): string {
    if (enactedBillsCache) {
      const found = enactedBillsCache.data.find((b: any) => b.BILL_ID === billId || b.billId === billId);
      if (found) return found.BILL_NM || found.BILL_NAME || found.billName || billId;
    }
    return billId;
  }

  app.get("/api/bills/:billId/member-votes", async (req, res) => {
    const { billId } = req.params;
    try {
      const cached = billVotesCache.get(billId);
      if (cached && Date.now() - cached.cachedAt < BILL_VOTES_CACHE_TTL) {
        return res.json({ source: "cache", votes: cached.votes });
      }

      const dbRows = await db.select().from(assemblyVotes).where(eq(assemblyVotes.billId, billId));
      if (dbRows.length > 0) {
        const votes: MemberVote[] = dbRows.map((r) => ({
          legislatorId: r.legislatorId,
          legislatorName: r.legislatorName || "",
          party: r.party || "",
          voteResult: r.voteResult || "",
        }));
        billVotesCache.set(billId, { votes, cachedAt: Date.now() });
        updateLegislatorVotesIndex(billId, getBillNameFromCache(billId), votes);
        return res.json({ source: "db", votes });
      }

      if (billVotesFetching.has(billId)) {
        const votes = await billVotesFetching.get(billId)!;
        return res.json({ source: "api", votes });
      }

      const fetchResultPromise = fetchBillMemberVotes(billId);
      billVotesFetching.set(billId, fetchResultPromise.then((r) => r.votes));
      const { votes, billName } = await fetchResultPromise;
      billVotesFetching.delete(billId);
      billVotesCache.set(billId, { votes, cachedAt: Date.now() });
      updateLegislatorVotesIndex(billId, billName, votes);

      return res.json({ source: "api", votes });
    } catch (error: any) {
      billVotesFetching.delete(billId);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/legislators/:monaCode/voted-bills", (req, res) => {
    const { monaCode } = req.params;
    const entries = legislatorVotesIndex.get(monaCode) ?? [];
    // 법안명이 billId인 경우 enacted bills cache에서 이름 보완
    const enriched = entries.map((e) => {
      if (e.billName === e.billId || e.billName.startsWith("PRC_")) {
        const fromCache = getBillNameFromCache(e.billId);
        return fromCache !== e.billId ? { ...e, billName: fromCache } : e;
      }
      return e;
    });
    res.json({ monaCode, bills: enriched, total: enriched.length });
  });

  // ===== 의원별 전체 표결 이력 (캐시 + API 배치 조회) =====
  app.get("/api/legislators/:monaCode/vote-history", async (req, res) => {
    const { monaCode } = req.params;

    // 1. 의원별 캐시 확인 (결과가 있을 때만 신뢰)
    const cached = legislatorHistoryCache.get(monaCode);
    if (cached && cached.votes.length > 0 && Date.now() - cached.cachedAt < LEGISLATOR_HISTORY_CACHE_TTL && !prefetchProgress.running) {
      return res.json({
        monaCode, votes: cached.votes, total: cached.votes.length, source: "cache",
        prefetchTotal: prefetchProgress.total,
        prefetchDone: prefetchProgress.done,
        prefetchRunning: prefetchProgress.running,
      });
    }

    const seenBills = new Set<string>();
    const votes: { billId: string; billName: string; voteResult: string }[] = [];

    // 2. 역인덱스에서 즉시 수집
    for (const entry of (legislatorVotesIndex.get(monaCode) ?? [])) {
      if (!seenBills.has(entry.billId)) {
        votes.push(entry);
        seenBills.add(entry.billId);
      }
    }

    // 3. billVotesCache 전체 스캔 (in-memory, 즉시)
    for (const [billId, cacheEntry] of Array.from(billVotesCache.entries())) {
      if (!seenBills.has(billId)) {
        const myVote = cacheEntry.votes.find((v: any) => v.legislatorId === monaCode);
        if (myVote) {
          const billName = getBillNameFromCache(billId);
          votes.push({ billId, billName, voteResult: myVote.voteResult });
          seenBills.add(billId);
        }
      }
    }

    // 4. DB에서 보완
    try {
      const dbRows = await db
        .select({
          billId: assemblyVotes.billId,
          voteResult: assemblyVotes.voteResult,
          billName: assemblyBills.billName,
        })
        .from(assemblyVotes)
        .leftJoin(assemblyBills, eq(assemblyVotes.billId, assemblyBills.billId))
        .where(eq(assemblyVotes.legislatorId, monaCode));
      for (const row of dbRows) {
        if (!seenBills.has(row.billId)) {
          votes.push({ billId: row.billId, billName: row.billName || row.billId, voteResult: row.voteResult || "" });
          seenBills.add(row.billId);
        }
      }
    } catch {}

    // 5. 캐시 데이터가 있으면 저장 (백그라운드 프리페치가 점진적으로 채움)
    if (votes.length > 0) {
      legislatorHistoryCache.set(monaCode, { votes, cachedAt: Date.now() });
    }
    res.json({
      monaCode,
      votes,
      total: votes.length,
      source: "fresh",
      prefetchTotal: prefetchProgress.total,
      prefetchDone: prefetchProgress.done,
      prefetchRunning: prefetchProgress.running,
    });
  });

  // ===== 의원별 발의 법안 목록 =====
  const proposedBillsCache = new Map<string, { bills: any[]; cachedAt: number }>();
  const PROPOSED_BILLS_CACHE_TTL = 12 * 60 * 60 * 1000; // 12시간

  app.get("/api/legislators/:monaCode/proposed-bills", async (req, res) => {
    const { monaCode } = req.params;
    const API_BASE = "https://open.assembly.go.kr/portal/openapi";
    const API_KEY = OPEN_API_KEY;

    const cached = proposedBillsCache.get(monaCode);
    if (cached && Date.now() - cached.cachedAt < PROPOSED_BILLS_CACHE_TTL) {
      return res.json({ monaCode, bills: cached.bills, total: cached.bills.length, source: "cache" });
    }

    if (!API_KEY) {
      return res.json({ monaCode, bills: [], total: 0, source: "no-api-key" });
    }

    try {
      const allBills: any[] = [];
      let pIndex = 1;
      const PAGE_SIZE = 100;

      while (true) {
        const response = await axios.get(`${API_BASE}/naitfmbillpropase`, {
          params: {
            Key: API_KEY,
            Type: "json",
            pIndex: String(pIndex),
            pSize: String(PAGE_SIZE),
            MONA_CD: monaCode,
          },
          timeout: 30000,
        });

        const serviceData = response.data?.naitfmbillpropase;
        if (!serviceData || !Array.isArray(serviceData)) break;

        const head = serviceData[0]?.head;
        const result = head?.[1]?.RESULT;
        if (result?.CODE && result.CODE !== "INFO-000") break;

        const totalCount = parseInt(head?.[0]?.list_total_count) || 0;
        const rows = serviceData[1]?.row;
        const pageRows = Array.isArray(rows) ? rows : [];
        allBills.push(...pageRows);

        const totalPages = Math.ceil(totalCount / PAGE_SIZE);
        if (pIndex >= totalPages || pageRows.length === 0) break;
        pIndex++;
        await new Promise((r) => setTimeout(r, 300));
      }

      proposedBillsCache.set(monaCode, { bills: allBills, cachedAt: Date.now() });
      return res.json({ monaCode, bills: allBills, total: allBills.length, source: "api" });
    } catch (error: any) {
      console.error("[proposed-bills] API 오류:", error.message);
      return res.status(500).json({ error: "발의 법안 조회 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/db/legislators/:id/votes", async (req, res) => {
    try {
      const rows = await db.select().from(assemblyVotes).where(eq(assemblyVotes.legislatorId, req.params.id));
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/db/legislators/:id/voting-records", async (req, res) => {
    try {
      const rows = await db
        .select({
          billId: assemblyVotes.billId,
          billName: assemblyBills.billName,
          voteResult: assemblyVotes.voteResult,
          proposeDate: assemblyBills.proposeDate,
        })
        .from(assemblyVotes)
        .leftJoin(assemblyBills, eq(assemblyVotes.billId, assemblyBills.billId))
        .where(eq(assemblyVotes.legislatorId, req.params.id as string))
        .orderBy(desc(assemblyBills.proposeDate))
        .limit(200);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/db/legislators/:id/stance", async (req, res) => {
    try {
      const stance = await calculatePoliticianStance(req.params.id as string);
      res.json(stance);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  function sanitizePost(post: any) {
    const { userId, ...safe } = post;
    return {
      ...safe,
      displayName: post.showRealName && post.authorName ? post.authorName : "익명의 유권자",
      nickname: post.anonNickname,
      authorBadges: post.authorBadges ?? [],
    };
  }

  function sanitizeComment(comment: any, postUserId: string) {
    const { userId, ...safe } = comment;
    return {
      ...safe,
      displayName: "익명의 유권자",
      isAuthor: comment.userId === postUserId,
      authorBadges: comment.authorBadges ?? [],
    };
  }

  app.get("/api/community/posts", async (req, res) => {
    try {
      const { board, category, sort, theme } = req.query as Record<string, string>;
      // 회원 게시판은 로그인 필요
      if (board === "members" && !req.session.userId) {
        return res.status(401).json({ error: "회원 게시판은 로그인이 필요합니다" });
      }
      // 뱃지 전용 테마 접근 제어
      if (theme) {
        const { BADGE_THEMES } = await import("@shared/schema");
        const themeConfig = BADGE_THEMES[theme];
        if (themeConfig) {
          if (!req.session.userId) {
            return res.status(401).json({ error: `${themeConfig.name}은 로그인이 필요합니다` });
          }
          const userBadges = await storage.getUserBadges(req.session.userId);
          if (!userBadges.includes(themeConfig.badge)) {
            return res.status(403).json({ error: `${themeConfig.name}에 입장하려면 '${themeConfig.badge}' 뱃지가 필요합니다`, requiredBadge: themeConfig.badge });
          }
        }
      }
      const posts = await storage.getPosts({
        boardType: theme || board || undefined,
        category: category || undefined,
        sort: sort || "latest",
      });
      res.json(posts.map(sanitizePost));
    } catch (error) {
      console.error("Get posts error:", error);
      res.status(500).json({ error: "게시글 조회 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/community/posts/:id", async (req, res) => {
    try {
      const post = await storage.getPost(req.params.id);
      if (!post) return res.status(404).json({ error: "게시글을 찾을 수 없습니다" });
      // 회원 게시판 글은 로그인 필요
      if (post.boardType === "members" && !req.session.userId) {
        return res.status(401).json({ error: "회원 게시판은 로그인이 필요합니다" });
      }
      // 조회수 증가 (비동기, 실패해도 무관)
      storage.incrementViewCount(post.id).catch(() => {});
      const comments = await storage.getComments(post.id);
      let userReactions: { sentiment: string | null; stance: string | null } = { sentiment: null, stance: null };
      let isBookmarked = false;
      if (req.session.userId) {
        userReactions = await storage.getUserReactions(post.id, req.session.userId);
        const bookmarks = await storage.getUserBookmarks(req.session.userId);
        isBookmarked = bookmarks.includes(post.id);
      }
      res.json({
        post: sanitizePost(post),
        comments: comments.map((c) => sanitizeComment(c, post.userId)),
        userReactions,
        isBookmarked,
      });
    } catch (error) {
      console.error("Get post error:", error);
      res.status(500).json({ error: "게시글 조회 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/community/posts", requireAuth, async (req, res) => {
    try {
      const result = insertPostSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "제목과 내용을 입력하세요" });
      }
      const nickname = getOrCreateNickname(req.session.userId!);
      const post = await storage.createPost(
        req.session.userId!,
        result.data.title,
        result.data.content,
        nickname,
        result.data.boardType ?? "open",
        result.data.category ?? "자유",
        result.data.showRealName ?? false,
      );
      res.json(sanitizePost({ ...post, authorBadges: await storage.getUserBadges(req.session.userId!), authorName: "" }));
    } catch (error) {
      console.error("Create post error:", error);
      res.status(500).json({ error: "게시글 작성 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/community/posts/:id/bookmark", requireAuth, async (req, res) => {
    try {
      const result = await storage.toggleBookmark(req.params.id as string, req.session.userId!);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "북마크 처리 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/community/bookmarks", requireAuth, async (req, res) => {
    try {
      const postIds = await storage.getUserBookmarks(req.session.userId!);
      if (postIds.length === 0) return res.json([]);
      // 북마크된 글 상세 조회
      const posts = await storage.getPosts();
      const bookmarked = posts.filter((p) => postIds.includes(p.id));
      res.json(bookmarked.map(sanitizePost));
    } catch (error) {
      res.status(500).json({ error: "북마크 조회 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/community/posts/:id/comments", requireAuth, async (req, res) => {
    try {
      const result = insertCommentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "댓글 내용을 입력하세요" });
      }
      const post = await storage.getPost(req.params.id as string);
      if (!post) return res.status(404).json({ error: "게시글을 찾을 수 없습니다" });
      const nickname = getOrCreateNickname(req.session.userId!);
      const comment = await storage.createComment(post.id, req.session.userId!, result.data.content, nickname);
      res.json(sanitizeComment(comment, post.userId));
    } catch (error) {
      console.error("Create comment error:", error);
      res.status(500).json({ error: "댓글 작성 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/community/posts/:id/react", requireAuth, async (req, res) => {
    try {
      const { type } = req.body;
      if (!["like", "dislike", "agree", "disagree"].includes(type)) {
        return res.status(400).json({ error: "잘못된 반응 유형입니다" });
      }
      await storage.addReaction(req.params.id as string, req.session.userId!, type);
      const post = await storage.getPost(req.params.id as string);
      const userReactions = await storage.getUserReactions(req.params.id as string, req.session.userId!);
      res.json({ post: post ? sanitizePost(post) : null, userReactions });
    } catch (error) {
      console.error("React error:", error);
      res.status(500).json({ error: "반응 처리 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/news", async (req, res) => {
    try {
      const now = Date.now();
      if (!newsCache || now - newsCache.cachedAt >= NEWS_CACHE_TTL) {
        const result = await fetchKoreanPoliticsNews();
        newsCache = { ...result, cachedAt: now };
      }

      const { source, view } = req.query as Record<string, string>;

      // 그룹(주제별) 보기
      if (view === "grouped") {
        return res.json({ grouped: newsCache.grouped, sources: Object.keys(SOURCE_META) });
      }

      // 특정 방송사 필터
      let items = newsCache.items;
      if (source && source !== "all") {
        items = items.filter((item) => item.sourceCode === source || item.source === source);
      }

      res.json({ items, sources: Object.keys(SOURCE_META) });
    } catch (error) {
      console.error("News fetch error:", error);
      res.json({ items: newsCache?.items || [], sources: [], grouped: [] });
    }
  });

  // 방송사 메타 정보 (색상 등)
  app.get("/api/news/sources", (_req, res) => {
    res.json(SOURCE_META);
  });

  app.post("/api/news/analyze", async (req, res) => {
    try {
      const { url, title: clientTitle, source: clientSource } = req.body;
      if (!url && !clientTitle) {
        return res.status(400).json({ error: "URL 또는 제목이 필요합니다." });
      }

      let analysisTitle = clientTitle || "";
      let analysisContent = "";

      // 1. 스크래핑 시도 (실패해도 제목으로 폴백)
      if (url) {
        try {
          const article = await scrapeNewsArticle(url);
          if (article?.content && article.content.length >= 200) {
            analysisContent = article.content;
          }
          if (article?.title && !analysisTitle) {
            analysisTitle = article.title;
          }
        } catch (scrapeErr) {
          console.warn("[news/analyze] 스크래핑 실패, 제목만으로 분석:", scrapeErr);
        }
      }

      if (!analysisTitle) {
        return res.status(400).json({ error: "기사 제목을 확인할 수 없습니다." });
      }

      // 2. AI 분석 (본문 없어도 제목+출처만으로 수행)
      const analysis = await analyzeNewsWithAI(analysisTitle, analysisContent, clientSource);

      res.json({ success: true, data: analysis });
    } catch (error: any) {
      console.error("News analyze error:", error);
      res.status(500).json({ error: error.message || "뉴스 분석 중 오류가 발생했습니다." });
    }
  });

  app.post("/api/community/report", requireAuth, async (req, res) => {
    try {
      const result = insertReportSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "신고 사유를 입력하세요" });
      }
      await storage.createReport(req.session.userId!, result.data.reason, result.data.postId, result.data.commentId);
      res.json({ success: true, message: "신고가 접수되었습니다" });
    } catch (error) {
      console.error("Report error:", error);
      res.status(500).json({ error: "신고 처리 중 오류가 발생했습니다" });
    }
  });

  // ===== 표결 사전 로드 진행 상태 API =====
  app.get("/api/prefetch-status", (_req, res) => {
    res.json({
      total: prefetchProgress.total,
      done: prefetchProgress.done,
      running: prefetchProgress.running,
      completedAt: prefetchProgress.completedAt,
    });
  });

  // ===== 서버 시작 후 백그라운드 사전 로드 (통과된 모든 법안 표결 캐시 구축) =====
  setTimeout(async () => {
    if (prefetchProgress.running) return;
    prefetchProgress.running = true;
    console.log("[startup] 백그라운드 전체 표결 사전 로드 시작...");
    try {
      if (!enactedBillsCache) {
        const apiRows = await fetchEnactedBillsFromApi(30);
        enactedBillsCache = { data: apiRows, fetchedAt: Date.now() };
        console.log(`[startup] 가결 법안 ${apiRows.length}건 로드 완료`);
      }
      const allBills = enactedBillsCache.data;
      const billsToFetch = allBills.filter((b: any) => {
        const bid = b.BILL_ID || b.billId;
        return bid && !billVotesCache.has(bid);
      });
      prefetchProgress.total = allBills.length;
      prefetchProgress.done = allBills.length - billsToFetch.length;
      console.log(`[startup] 전체 ${allBills.length}건 중 ${billsToFetch.length}건 미캐시 → 순차 로드 시작`);
      const BATCH = 6;
      for (let i = 0; i < billsToFetch.length; i += BATCH) {
        await Promise.all(
          billsToFetch.slice(i, i + BATCH).map(async (b: any) => {
            const billId = b.BILL_ID || b.billId;
            if (!billId || billVotesCache.has(billId)) { prefetchProgress.done++; return; }
            try {
              const result = await fetchBillMemberVotes(billId);
              billVotesCache.set(billId, { votes: result.votes, cachedAt: Date.now() });
              updateLegislatorVotesIndex(billId, result.billName, result.votes);
            } catch {}
            prefetchProgress.done++;
          })
        );
        if (i % 60 === 0) {
          console.log(`[startup] 표결 로드 진행: ${prefetchProgress.done}/${prefetchProgress.total}`);
        }
      }
      prefetchProgress.running = false;
      prefetchProgress.completedAt = Date.now();
      console.log(`[startup] 전체 표결 사전 로드 완료 (${billVotesCache.size}개 법안 캐시)`);
    } catch (err: any) {
      prefetchProgress.running = false;
      console.error("[startup] 표결 사전 로드 오류:", err.message);
    }
  }, 8000);

  return httpServer;
}
