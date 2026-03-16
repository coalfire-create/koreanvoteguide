import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import session from "express-session";
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
import { eq, desc, inArray } from "drizzle-orm";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";

// ===== 뉴스 캐시 (15분) =====
let newsCache: { items: NewsItem[]; cachedAt: number } | null = null;
const NEWS_CACHE_TTL = 15 * 60 * 1000;

// ===== 법안별 의원 표결 캐시 (12시간) =====
const billVotesCache = new Map<string, { votes: MemberVote[]; cachedAt: number }>();
const BILL_VOTES_CACHE_TTL = 12 * 60 * 60 * 1000;
const billVotesFetching = new Map<string, Promise<MemberVote[]>>();

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

function extractText(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (val.__cdata) return String(val.__cdata);
  if (val["#text"]) return String(val["#text"]);
  return String(val);
}

async function fetchKoreanPoliticsNews(): Promise<NewsItem[]> {
  const RSS_FEEDS = [
    { url: "https://www.yna.co.kr/rss/politics.xml", source: "연합뉴스" },
    { url: "https://www.chosun.com/arc/outboundfeeds/rss/category/politics/?outputType=xml", source: "조선일보" },
  ];

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    cdataPropName: "__cdata",
  });
  const allItems: NewsItem[] = [];

  for (const feed of RSS_FEEDS) {
    try {
      const res = await axios.get(feed.url, { timeout: 10000, headers: { "User-Agent": "Mozilla/5.0" } });
      const parsed = parser.parse(res.data);
      const rawItems = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
      const items = Array.isArray(rawItems) ? rawItems : [rawItems];
      for (const item of items.slice(0, 15)) {
        const title = extractText(item.title);
        const link = typeof item.link === "string"
          ? item.link
          : extractText(item.link?.["@_href"]) || extractText(item.guid) || "";
        const pubDate = extractText(item.pubDate || item.updated || item.published || "");
        if (title && link) {
          allItems.push({ title: title.trim(), link, pubDate, source: feed.source });
        }
      }
    } catch (err: any) {
      console.error(`[news] ${feed.source} RSS 오류:`, err.message);
    }
  }

  console.log(`[news] 수집된 뉴스: ${allItems.length}건`);
  return allItems.slice(0, 20);
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const PgStore = pgSession(session);

  app.use(
    session({
      store: new PgStore({
        pool,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "vote-with-reason-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      },
    })
  );

  app.post("/api/auth/send-code", async (req, res) => {
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

      res.json({
        success: true,
        message: "인증번호가 발송되었습니다",
        demoCode: code,
      });
    } catch (error) {
      console.error("Send code error:", error);
      res.status(500).json({ error: "인증번호 발송 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
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

  app.post("/api/auth/login", async (req, res) => {
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

    res.json({
      user: { id: user.id, username: user.username, name: user.name },
    });
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
      const cached = await storage.getCachedData("members");
      if (cached && cached.length > 0) {
        return res.json({ source: "api", data: cached });
      }
      return res.json({ source: "mock", data: null });
    } catch (error) {
      res.status(500).json({ error: "의원 데이터 조회 중 오류가 발생했습니다" });
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
      const cached = await storage.getCachedData("bills");
      if (cached && cached.length > 0) {
        return res.json({ source: "api", data: cached });
      }
      return res.json({ source: "mock", data: null });
    } catch (error) {
      res.status(500).json({ error: "법안 데이터 조회 중 오류가 발생했습니다" });
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
      const cached = await storage.getCachedData("attendance");
      if (cached && cached.length > 0) {
        return res.json({ source: "api", data: cached });
      }
      return res.json({ source: "mock", data: null });
    } catch (error) {
      res.status(500).json({ error: "출석 데이터 조회 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/refresh", requireAuth, async (_req, res) => {
    try {
      const result = await fetchAssemblyData();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "수동 갱신 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/sync", requireAuth, async (_req, res) => {
    try {
      const result = await syncAll();
      res.json({ ok: true, result });
    } catch (error: any) {
      res.status(500).json({ error: `동기화 실패: ${error.message}` });
    }
  });

  app.post("/api/sync/legislators", requireAuth, async (_req, res) => {
    try {
      const result = await syncLegislators();
      res.json({ ok: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sync/bills", requireAuth, async (_req, res) => {
    try {
      const result = await syncBills();
      res.json({ ok: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sync/votes", requireAuth, async (_req, res) => {
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
        return res.json({ source: "db", votes });
      }

      if (billVotesFetching.has(billId)) {
        const votes = await billVotesFetching.get(billId)!;
        return res.json({ source: "api", votes });
      }

      const fetchPromise = fetchBillMemberVotes(billId);
      billVotesFetching.set(billId, fetchPromise);
      const votes = await fetchPromise;
      billVotesFetching.delete(billId);
      billVotesCache.set(billId, { votes, cachedAt: Date.now() });

      return res.json({ source: "api", votes });
    } catch (error: any) {
      billVotesFetching.delete(billId);
      res.status(500).json({ error: error.message });
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
    return { ...safe, displayName: "익명의 유권자", nickname: post.anonNickname };
  }

  function sanitizeComment(comment: any, postUserId: string) {
    const { userId, ...safe } = comment;
    return { ...safe, displayName: "익명의 유권자", isAuthor: comment.userId === postUserId };
  }

  app.get("/api/community/posts", async (_req, res) => {
    try {
      const posts = await storage.getPosts();
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
      const comments = await storage.getComments(post.id);
      let userReactions: { sentiment: string | null; stance: string | null } = { sentiment: null, stance: null };
      if (req.session.userId) {
        userReactions = await storage.getUserReactions(post.id, req.session.userId);
      }
      res.json({
        post: sanitizePost(post),
        comments: comments.map((c) => sanitizeComment(c, post.userId)),
        userReactions,
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
      const post = await storage.createPost(req.session.userId!, result.data.title, result.data.content, nickname);
      res.json(sanitizePost(post));
    } catch (error) {
      console.error("Create post error:", error);
      res.status(500).json({ error: "게시글 작성 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/community/posts/:id/comments", requireAuth, async (req, res) => {
    try {
      const result = insertCommentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "댓글 내용을 입력하세요" });
      }
      const post = await storage.getPost(req.params.id);
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
      await storage.addReaction(req.params.id, req.session.userId!, type);
      const post = await storage.getPost(req.params.id);
      const userReactions = await storage.getUserReactions(req.params.id, req.session.userId!);
      res.json({ post: post ? sanitizePost(post) : null, userReactions });
    } catch (error) {
      console.error("React error:", error);
      res.status(500).json({ error: "반응 처리 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/news", async (_req, res) => {
    try {
      const now = Date.now();
      if (newsCache && now - newsCache.cachedAt < NEWS_CACHE_TTL) {
        return res.json(newsCache.items);
      }
      const items = await fetchKoreanPoliticsNews();
      newsCache = { items, cachedAt: now };
      res.json(items);
    } catch (error) {
      console.error("News fetch error:", error);
      res.json(newsCache?.items || []);
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

  return httpServer;
}
