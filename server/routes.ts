import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { type Server } from "http";
import session from "express-session";
import createMemoryStore from "memorystore";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { registerSchema, loginSchema, phoneVerificationSchema, insertPostSchema, insertCommentSchema, insertReportSchema, insertBlockSchema, favoritesUpdateSchema } from "@shared/schema";
import { scrypt, randomBytes, timingSafeEqual, createHmac } from "crypto";
import { promisify } from "util";
import pgSession from "connect-pg-simple";
import { pool, db } from "./db";
const MemoryStore = createMemoryStore(session);
import { fetchAssemblyData } from "./scheduler";
import { syncAll, syncLegislators, syncBills, syncVotes, fetchEnactedBillsFromApi, fetchBillMemberVotes, type MemberVote } from "./api-sync";
import { calculatePoliticianStance } from "./stance";
import { analyzeLegislator } from "./legislator-analysis";
import { analyzePolicyStance, isPolicyDimension, type PolicyDimension, type StanceAnalystReport } from "./stance-analyst";
import {
  generateCandidateReport,
  CandidateNotFoundError,
  InsufficientDataError,
} from "./candidate-report";
import { legislators, assemblyBills, assemblyVotes, electionCandidates, candidateStatements, statementFactChecks, candidateSupportVotes, reactions, pollComments, billOpinionVotes, searchHistory, communityPosts, communityComments, users, userFollows, electionSchedules, insertElectionScheduleSchema, pledgeRatings, pledgeComments, announcements, insertAnnouncementSchema, dailyPolls, dailyPollVotes } from "@shared/schema";
import { scrapeNewsArticle, analyzeNewsWithAI } from "./api/news-analyzer";
import { crawlNesdcPolls, getLatestPolls } from "./nesdc-crawler";
import { getTrendingMembersWithCache, clearTrendingMembersCache } from "./trending-members-crawler";
import { getPoliticianPhotoUrl, proxyImage, getBatchPhotoUrls, preFetchPhotos } from "./photo-service";
import { callLLMText, callLLMJson, callLLMJsonOrFallback, LLMConfigError, LLMTransientError, LLMParseError } from "./utils/llm-wrapper";
import { getAiCache, setAiCache } from "./utils/ai-cache";
import { LruMap } from "./utils/lru";
import { fetchRecentNews, stripHtml, type RecentNewsItem } from "./utils/news";
import { sanitizeHtml, sanitizeText } from "./utils/sanitize";
import { saveUploadedImage, extForMime, isSupabaseStorageConfigured } from "./utils/storage-upload";
import { sendPush, isApnsConfigured } from "./utils/apns";
import { calculateAgeGroup, parseBirthDate, normalizeGender } from "./utils/age";
import {
  loadKakaoConfig,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchKakaoProfile,
  mapKakaoAgeRange,
  mapKakaoGender,
  mapKakaoBirthYear,
} from "./utils/kakao-oauth";
import {
  loadGoogleConfig,
  buildAuthorizeUrl as buildGoogleAuthorizeUrl,
  exchangeCodeForToken as exchangeGoogleCodeForToken,
  fetchGoogleProfile,
} from "./utils/google-oauth";
import {
  loadAppleConfig,
  buildAuthorizeUrl as buildAppleAuthorizeUrl,
  exchangeCodeForToken as exchangeAppleCodeForToken,
  verifyIdToken as verifyAppleIdToken,
} from "./utils/apple-oauth";
import { isPollPublicationBlackout } from "./utils/election-blackout";
import { pollResults } from "@shared/schema";
import { eq, desc, asc, gte, inArray, and, sql as dsql, count, notInArray, or, ilike, like, isNull, gt } from "drizzle-orm";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import multer from "multer";
import path from "path";
import crypto from "crypto";

const isProduction = process.env.NODE_ENV === "production";

// 인물 탭 타임라인 — 사용자별 60초 메모리 캐시 (팔로우/트렌딩/법안은 분 단위로 변함)
const timelineCache = new Map<string, { payload: any; cachedAt: number }>();
const TIMELINE_CACHE_TTL = 60 * 1000;

export function clearTimelineCacheForUser(userId: string) {
  for (const key of timelineCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      timelineCache.delete(key);
    }
  }
}

// ===== AI 평가 (POST /api/ai/evaluate) — 타입 + Strict-Neutrality 프롬프트 =====
//
// 본 프롬프트는 "데이터 기반 객관 분석"만 허용한다. 외부 지식·주관 형용사 사용 금지.
// 두 평가 축은 0~10 정수 스케일로 강제한다 (UI 슬라이더와 1:1 매핑).
//   - economy: 0=친노동/규제, 10=친시장/규제완화
//   - society: 0=진보/복지중시, 10=보수/질서중시
//
// LLM 응답은 반드시 EvaluatePayload 스키마를 따라야 한다.
interface EvaluateAxis {
  score: number;          // 0~10 정수
  reasoning: string;      // 어떤 데이터(법안/표결/뉴스)에 근거했는지
}

interface EvaluateInterest {
  category: string;
  percentage: number;     // 0~100
  evidence_count: number; // 해당 카테고리에 매칭된 데이터 건수
}

interface EvaluateNewsEvidence {
  statementSummary: string;
  sourceDate: string;     // yyyy-mm-dd
  impact: string;         // 어떤 축을 어느 방향으로 이동시키는 근거인지
}

interface EvaluatePayload {
  summary: string;
  axes: { economy: EvaluateAxis; society: EvaluateAxis };
  topInterests: EvaluateInterest[];
  newsEvidence: EvaluateNewsEvidence[];
}

const STRICT_NEUTRALITY_SYSTEM_PROMPT = `당신은 고도로 객관적이고 중립적인 정치 데이터 분석가입니다.

[절대 규칙]
1. 외부 지식을 사용하지 마십시오. 오직 사용자가 제공한 JSON 데이터(대표 발의 법안, 본회의 표결, 최근 뉴스 및 발언)에만 근거하여 분석하십시오.
2. 주관적 형용사(예: "열정적인", "헌신적인", "유능한", "무능한")를 사용하지 마십시오. 사실과 데이터만 서술하십시오.
3. 정당·이념을 칭찬하거나 비난하지 마십시오. 기록된 행동(발의·표결·발언)만 인용하십시오.
4. 데이터에 없는 내용을 추론·상상·가정하지 마십시오. 데이터가 부족하면 부족하다고 명시하십시오.
5. 모든 점수와 근거는 입력 JSON의 특정 항목(법안 제목, 표결 결과, 뉴스 제목·날짜)을 직접 인용해야 합니다.

[평가 축 정의]
- economy (0~10 정수): 0 = 친노동/규제 강화, 10 = 친시장/규제 완화. 5는 중도.
- society (0~10 정수): 0 = 진보/복지 중시, 10 = 보수/질서 중시. 5는 중도.

[출력 형식 — 아래 JSON 스키마만 출력. 다른 텍스트 금지]
{
  "summary": "2~3문장의 객관적·사실 기반 요약. 주관적 평가 형용사 금지.",
  "axes": {
    "economy": { "score": 4, "reasoning": "법안 A 발의 및 뉴스 B 발언에 근거함" },
    "society": { "score": 7, "reasoning": "법안 C에 반대표를 던진 기록에 근거함" }
  },
  "topInterests": [
    { "category": "국방", "percentage": 30, "evidence_count": 5 }
  ],
  "newsEvidence": [
    {
      "statementSummary": "부동산 세제 완화 주장",
      "sourceDate": "2024-05-10",
      "impact": "경제 성향을 10점(시장친화) 쪽으로 이동시키는 근거가 됨"
    }
  ]
}

[추가 제약]
- topInterests 의 percentage 합은 100이 되도록 작성하십시오. 카테고리는 입력 데이터의 위원회/카테고리/뉴스 키워드에서 도출합니다.
- newsEvidence 는 입력의 [최근 뉴스 및 발언] 배열에서 점수 산출에 직접 영향을 준 항목만 포함하십시오. 뉴스가 없으면 빈 배열을 출력하십시오.
- axes.*.reasoning 은 50자 이내, 반드시 입력 데이터의 구체적 항목을 가리켜야 합니다.
- 데이터가 한쪽으로 치우치지 않은 경우에는 5(중도)에 가까운 점수를 부여하십시오.`;

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

// AI 엔드포인트 — 비용 과다 호출 방지. IP당 10분에 15회.
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  message: { error: "AI 분석 요청이 너무 많습니다. 10분 후 다시 시도해주세요." },
  standardHeaders: true,
  legacyHeaders: false,
});

// 커뮤니티 글/댓글 작성·수정 — 도배 방지(전역 120/분보다 엄격). IP 기준 공유 카운트.
const communityWriteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 20,
  message: { error: "글/댓글 작성이 너무 잦습니다. 잠시 후 다시 시도해주세요." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ===== 뉴스 캐시 (15분) =====
let newsCache: { items: NewsItem[]; grouped: NewsGroup[]; cachedAt: number } | null = null;
const NEWS_CACHE_TTL = 15 * 60 * 1000;

// ===== 선거 후보 목록 캐시 (10분) — DB 우선, 외부 NEC API 폴백 결과도 캐시 =====
const electionCandidateCache = new Map<string, { data: any[]; cachedAt: number }>();
const ELECTION_CANDIDATE_TTL = 10 * 60 * 1000;

// ===== 후보자 등록 마감 — 마감 후에는 정식후보자만 노출 =====
// 2026 지방선거 후보자 등록 마감: 2026-05-15 (KST). 마감 이후에는
// 라이프사이클 라벨이 '예비후보'인 레코드(예비후보자)를 숨기고 정식후보자만 노출.
const CANDIDATE_REGISTRATION_DEADLINE = new Date("2026-05-15T23:59:59+09:00").getTime();
function isAfterCandidateRegistration(): boolean {
  return Date.now() > CANDIDATE_REGISTRATION_DEADLINE;
}

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
  summary?: string;   // RSS description/요약 (HTML 제거, 문장 단위 컷)
}

// RSS description/Atom summary를 깔끔한 2~3문장 요약으로. HTML 제거 후
// 문장 경계에서 자르고 최대 길이를 넘으면 말줄임. 제목과 동일하면 버린다.
function toSummary(raw: string, title: string, maxLen = 160): string {
  let clean = stripHtml(extractText(raw)).replace(/\s+/g, " ").trim();
  // 연합/뉴스1 등 바이라인 제거: "(서울=연합뉴스) 홍길동 기자 = 본문..."
  clean = clean
    .replace(/^\(\s*[^)]*=\s*[^)]*\)\s*/, "")
    .replace(/^[가-힣]{2,5}\s*(기자|특파원|논설위원)\s*=\s*/, "")
    .trim();
  // 본문이 거의 없는 속보/스텁(괄호·기호만 남는 경우)은 요약 생략
  if (clean.replace(/[()[\]·\-–—.,\s]/g, "").length < 10) return "";
  // 제목이 그대로 들어온 피드(연합 등)는 요약으로 무의미 → 제거
  if (clean === title.trim() || clean.startsWith(title.trim())) {
    const rest = clean.slice(title.trim().length).replace(/^[\s\-–—:|]+/, "").trim();
    if (rest.length < 10) return "";
    return rest.length > maxLen ? rest.slice(0, maxLen).trim() + "…" : rest;
  }
  if (clean.length <= maxLen) return clean;
  // maxLen 근처의 문장 끝(. ? ! 다/요)에서 자르기
  const cut = clean.slice(0, maxLen);
  const lastStop = Math.max(
    cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "),
    cut.lastIndexOf("다 "), cut.lastIndexOf("다."),
  );
  return (lastStop > 60 ? cut.slice(0, lastStop + 1) : cut).trim() + "…";
}

interface NewsGroup {
  headline: string;
  articles: NewsItem[];
}

// 방송사별 색상 및 코드
const SOURCE_META: Record<string, { label: string; code: string; color: string }> = {
  "연합뉴스":  { label: "연합",   code: "yna",       color: "bg-red-100 text-red-700 border-red-200" },
  "SBS":      { label: "SBS",    code: "sbs",       color: "bg-pink-100 text-pink-700 border-pink-200" },
  "한겨레":   { label: "한겨레",  code: "hani",      color: "bg-green-100 text-green-700 border-green-200" },
  "경향신문": { label: "경향",    code: "khan",      color: "bg-teal-100 text-teal-700 border-teal-200" },
  "조선일보": { label: "조선",    code: "chosun",    color: "bg-slate-100 text-slate-700 border-slate-200" },
  "동아일보": { label: "동아",    code: "donga",     color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  "뉴시스":   { label: "뉴시스",  code: "newsis",    color: "bg-sky-100 text-sky-700 border-sky-200" },
  "오마이뉴스": { label: "오마이", code: "ohmynews", color: "bg-orange-100 text-orange-700 border-orange-200" },
  "미디어오늘": { label: "미디어오늘", code: "mediatoday", color: "bg-purple-100 text-purple-700 border-purple-200" },
};

// User-Agent: 주요 언론사 차단 우회용 브라우저 헤더
const RSS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/rss+xml, application/xml, text/xml, */*",
  "Accept-Language": "ko-KR,ko;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
};

const RSS_FEEDS = [
  { url: "https://www.yna.co.kr/rss/politics.xml",                                                source: "연합뉴스",   limit: 15 },
  { url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=02&plink=RSSREADER",            source: "SBS",       limit: 10 },
  { url: "https://www.hani.co.kr/rss/politics",                                                   source: "한겨레",    limit: 10 },
  { url: "https://www.khan.co.kr/rss/rssdata/politic_news.xml",                                   source: "경향신문",  limit: 10 },
  { url: "https://www.chosun.com/arc/outboundfeeds/rss/category/politics/?outputType=xml",        source: "조선일보",  limit: 10 },
  { url: "https://rss.donga.com/politics.xml",                                                    source: "동아일보",  limit: 10 },
  { url: "https://www.newsis.com/RSS/politics.xml",                                               source: "뉴시스",    limit: 10 },
  { url: "https://rss.ohmynews.com/rss/politics.xml",                                             source: "오마이뉴스", limit: 8 },
  { url: "https://www.mediatoday.co.kr/rss/allArticle.xml",                                       source: "미디어오늘", limit: 8 },
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

async function fetchNaverNews(query: string): Promise<NewsItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log("[news] Naver API 키가 설정되지 않아 건너뜁니다.");
    return [];
  }

  try {
    const res = await axios.get("https://openapi.naver.com/v1/search/news.json", {
      params: {
        query,
        display: 100,
        sort: "date",
      },
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
      timeout: 5000,
    });

    const items = res.data?.items || [];
    return items.map((item: any) => {
      const t = stripHtml(item.title);
      return {
        title: t,
        link: item.originallink || item.link,
        pubDate: new Date(item.pubDate).toISOString(),
        source: "네이버뉴스",
        sourceCode: "naver",
        thumbnail: "", // 네이버 검색 API는 썸네일을 제공하지 않음
        summary: toSummary(item.description ?? "", t),
      };
    });
  } catch (err: any) {
    console.error("[news] Naver API 오류:", err.message);
    return [];
  }
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
          timeout: 10000,
          headers: RSS_HEADERS,
          maxRedirects: 5,
          decompress: true,
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
          // 1) 표준 미디어 필드(media:content/media:thumbnail/enclosure) — 단일 또는 배열
          // 2) description/content:encoded HTML 안의 첫 <img src> (한국 RSS 대다수)
          const pickUrl = (node: any): string => {
            if (!node) return "";
            if (Array.isArray(node)) {
              for (const n of node) {
                const u = pickUrl(n);
                if (u) return u;
              }
              return "";
            }
            return node["@_url"] || node.url || "";
          };
          const extractFirstImg = (raw: any): string => {
            const s = typeof raw === "string" ? raw : extractText(raw);
            if (!s) return "";
            // src 가 따옴표로 감싸지지 않는 경우도 처리 (한겨레 등 비표준 HTML)
            const m = s.match(/<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
            return m?.[1] || m?.[2] || m?.[3] || "";
          };
          let thumbnail =
            pickUrl(item["media:content"]) ||
            pickUrl(item["media:thumbnail"]) ||
            pickUrl(item.enclosure) ||
            extractFirstImg(item["content:encoded"]) ||
            extractFirstImg(item.description) ||
            extractFirstImg(item.summary) ||
            "";
          if (typeof thumbnail !== "string") thumbnail = "";
          if (thumbnail.startsWith("//")) thumbnail = "https:" + thumbnail;
          // http → https 강제 (HTTPS WebView 에서 mixed-content 차단 방지)
          if (thumbnail.startsWith("http://")) thumbnail = "https://" + thumbnail.slice(7);
          const rawSummary =
            item.description ?? item.summary ?? item["content:encoded"] ?? item.content ?? "";
          if (title && link) {
            allItems.push({
              title: title.trim(),
              link,
              pubDate,
              source: feed.source,
              sourceCode: meta.code,
              thumbnail,
              summary: toSummary(rawSummary, title),
            });
          }
        }
        console.log(`[news] ${feed.source}: ${feedItems.length}건 수신`);
      } catch (err: any) {
        console.error(`[news] ${feed.source} RSS 오류:`, err.message);
      }
    })
  );

  // 네이버 뉴스 검색 통합
  const naverNews = await fetchNaverNews("정치");
  if (naverNews.length > 0) {
    allItems.push(...naverNews);
    console.log(`[news] 네이버뉴스: ${naverNews.length}건 수신`);
  }

  // RSS 에 이미지가 없는 항목(경향/미디어오늘/일부 다른 매체) → 기사 HTML 의 og:image 로 보완.
  // 캐시 15분 수명 안에서만 동작하므로 외부 호출 한 번이면 다음 갱신까지 재사용.
  // 병렬·짧은 timeout·실패 무시.
  const needsOg = allItems.filter((i) => !i.thumbnail && i.link && /^https?:\/\//.test(i.link));
  if (needsOg.length > 0) {
    const ogResults = await Promise.allSettled(
      needsOg.map((item) =>
        axios.get(item.link, { timeout: 4000, headers: RSS_HEADERS, maxRedirects: 3, responseType: "text" })
          .then((res) => {
            const html: string = typeof res.data === "string" ? res.data : "";
            // <meta property="og:image" content="..."> 또는 name="og:image"/twitter:image
            const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["']/i)
              || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
            return m?.[1] ?? "";
          })
          .catch(() => "")
      )
    );
    let filled = 0;
    ogResults.forEach((r, idx) => {
      if (r.status === "fulfilled" && r.value) {
        let u = r.value;
        if (u.startsWith("//")) u = "https:" + u;
        if (u.startsWith("http://")) u = "https://" + u.slice(7);
        needsOg[idx].thumbnail = u;
        filled++;
      }
    });
    console.log(`[news] og:image fallback ${filled}/${needsOg.length}건 보완`);
  }

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

// 로그인 사용자는 userId, 비로그인은 안정적 anon:<uuid> 를 반환.
// 비로그인 시 req.session.anonId 를 1회 생성·저장(세션 modified → 쿠키 발급)
// 하여 이후 요청에서 동일 식별자가 유지되도록 한다.
function getActorId(req: Request): string {
  if (req.session.userId) return req.session.userId;
  if (!req.session.anonId) {
    req.session.anonId = randomBytes(16).toString("hex");
  }
  return `anon:${req.session.anonId}`;
}

// 읽기 전용 — 세션을 새로 만들지 않는다(단순 열람자마다 세션 row 생성 방지).
// 이미 식별자가 있을 때만 반환, 없으면 null(아직 아무 액션도 안 한 익명).
function peekActorId(req: Request): string | null {
  if (req.session.userId) return req.session.userId;
  if (req.session.anonId) return `anon:${req.session.anonId}`;
  return null;
}

// anon:* / "anonymous" 는 users 테이블에 없으므로 뱃지 조회를 건너뛴다.
function isAnonId(id: string): boolean {
  return id === "anonymous" || id.startsWith("anon:");
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = (stored || "").split(".");
  // OAuth(빈 비밀번호) 계정·손상된 해시: 예외/타이밍 누출 없이 인증 실패 처리
  if (!hashed || !salt) return false;
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  const storedBuf = Buffer.from(hashed, "hex");
  // timingSafeEqual은 길이가 다르면 throw → 사전 길이 검사로 크래시 방지
  if (storedBuf.length !== suppliedBuf.length) return false;
  return timingSafeEqual(storedBuf, suppliedBuf);
}

// 전화번호 lookup용 HMAC. 평문 phone은 그대로 두되, 중복 검사·재로그인 식별은 hash로.
// PHONE_PEPPER는 한 번 정하면 절대 변경 금지 (변경하면 기존 hash 모두 무효).
export function hashPhone(phone: string): string {
  const pepper = process.env.PHONE_PEPPER || "";
  if (!pepper && isProduction) {
    throw new Error("프로덕션에서는 PHONE_PEPPER 환경변수가 반드시 필요합니다.");
  }
  return createHmac("sha256", pepper || "dev-pepper").update(phone).digest("hex");
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    // 비로그인(익명) 사용자의 안정적 식별자. saveUninitialized:false 라
    // req.sessionID 는 매 요청 바뀌므로, 익명 좋아요/댓글 중복방지·작성자판별·
    // 닉네임 고정을 위해 첫 익명 액션 시 1회 생성해 세션에 저장(쿠키 고정).
    anonId?: string;
    kakaoOAuthState?: string;
    naverOAuthState?: string;
    googleOAuthState?: string;
    appleOAuthState?: string;
    // 동적 redirect URI — authorize 단계에서 저장, callback에서 토큰 교환 시 재사용
    kakaoRedirectUri?: string;
    googleRedirectUri?: string;
    appleRedirectUri?: string;
    oauthNext?: string;
    // 네이티브 앱(시스템 브라우저) OAuth 여부 — true면 콜백에서 딥링크+1회용 코드로 처리
    oauthNative?: boolean;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "로그인이 필요합니다" });
  }
  next();
}

// 로컬(아이디/비번) 회원가입 + SMS 인증은 v1에서 소셜 로그인으로 일원화.
// 운영용 SMS 발송이 연동되지 않은 상태라 회원가입 경로를 막아 "코드를 영영 못 받는" 상태를 차단한다.
// 재활성화하려면 ENABLE_LOCAL_SIGNUP=1 + SMS_PROVIDER 환경변수를 함께 설정해야 한다.
function localSignupGuard(_req: Request, res: Response, next: NextFunction) {
  const enabled =
    process.env.ENABLE_LOCAL_SIGNUP === "1" && Boolean(process.env.SMS_PROVIDER);
  if (isProduction && !enabled) {
    return res.status(403).json({
      error: "현재 카카오·구글·애플 로그인만 지원합니다.",
      code: "LOCAL_SIGNUP_DISABLED",
    });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "로그인이 필요합니다" });
  }
  const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  // Fail-closed: ADMIN_USER_IDS가 비어있으면 모든 사용자를 거부 (이전 fail-open 버그 제거)
  if (adminIds.length === 0 || !adminIds.includes(req.session.userId)) {
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
  const sessionStore = isProduction 
    ? new PgStore({
        pool,
        createTableIfMissing: true,
        ttl: 7 * 24 * 60 * 60, // 7일 (초 단위)
      })
    : new MemoryStore({
        checkPeriod: 86400000 // 하루 (ms 단위)
      });

  if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
    throw new Error("프로덕션 환경에서는 SESSION_SECRET(32자 이상) 환경변수가 반드시 필요합니다.");
  }

  app.use(
    session({
      store: sessionStore,
      // 개발에서는 fallback이 있어도 무방하지만, 프로덕션은 위 가드로 차단됨
      secret: process.env.SESSION_SECRET || "vote-with-reason-dev-secret-key",
      resave: false,
      saveUninitialized: false,
      name: "kvg.sid",
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
      },
    })
  );

  // 일반 API에 rate limit 적용
  app.use("/api/", apiLimiter);

  // ===== SMS OTP 인증 =====
  // 1) 발송: /api/auth/send-sms (신규 이름) + /api/auth/send-code (기존 호환)
  // 2) 검증: /api/auth/verify-sms (read-only, mark used는 register에서)
  // dev 환경에서는 콘솔에 [MOCK SMS] 출력만 하고, 응답에 demoCode 포함.
  const sendSmsHandler = async (req: Request, res: Response) => {
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

      // 운영에서는 SMS_PROVIDER(NHN Cloud, Aligo, NAVER Cloud SENS 등) 어댑터 연동 필요.
      // 자체 SMS는 "단순 가입 인증"용이며 "본인확인"으로 인정되지 않는다.
      const provider = process.env.SMS_PROVIDER?.toLowerCase();
      if (isProduction) {
        if (!provider) {
          // 어댑터 미연동 시 프로덕션에서는 실패로 명시 — 사용자가 영영 코드를 못 받는 상황 방지
          return res.status(503).json({
            error: "SMS 발송 서비스가 설정되지 않았습니다. 잠시 후 다시 시도해주세요.",
          });
        }
        // TODO: 어댑터별 SDK 호출 — 현 시점에서는 미구현
        console.warn(`[sms] provider=${provider} 미구현 — 코드를 발송하지 않음`);
      } else {
        console.log(`[MOCK SMS] To: ${normalizedPhone}, Code: ${code} (expires in 3 min)`);
      }

      const response: Record<string, any> = {
        success: true,
        message: "인증번호가 발송되었습니다",
        expiresAt: expiresAt.toISOString(),
        ttlSeconds: 180,
      };
      if (!isProduction) {
        response.demoCode = code;
      }
      res.json(response);
    } catch (error) {
      console.error("Send code error:", error);
      res.status(500).json({ error: "인증번호 발송 중 오류가 발생했습니다" });
    }
  };

  app.post("/api/auth/send-sms", localSignupGuard, sendCodeLimiter, sendSmsHandler);
  app.post("/api/auth/send-code", localSignupGuard, sendCodeLimiter, sendSmsHandler);

  // 검증 — register 전에 코드만 미리 확인. mark used는 하지 않으므로 register에서 한 번 더 검증/소비.
  app.post("/api/auth/verify-sms", localSignupGuard, sendCodeLimiter, async (req, res) => {
    try {
      const { phone, code } = req.body ?? {};
      if (typeof phone !== "string" || typeof code !== "string") {
        return res.status(400).json({ success: false, error: "휴대폰 번호와 인증번호를 입력하세요." });
      }
      const phoneCheck = phoneVerificationSchema.safeParse({ phone });
      if (!phoneCheck.success) {
        return res.status(400).json({ success: false, error: "올바른 휴대폰 번호를 입력하세요." });
      }
      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({ success: false, error: "6자리 숫자 인증번호를 입력하세요." });
      }
      const normalizedPhone = phone.replace(/-/g, "");
      const record = await storage.getVerificationCode(normalizedPhone, code);
      if (!record) {
        return res.status(400).json({ success: false, error: "인증번호가 올바르지 않거나 만료되었습니다." });
      }
      // 의도적으로 mark used 하지 않음 — register 호출 시 동일 코드를 한 번 더 검증/소비.
      res.json({ success: true, message: "인증되었습니다." });
    } catch (error) {
      console.error("verify-sms error:", error);
      res.status(500).json({ success: false, error: "인증 처리 중 오류가 발생했습니다." });
    }
  });

  app.post("/api/auth/register", localSignupGuard, authLimiter, async (req, res) => {
    try {
      const result = registerSchema.safeParse(req.body);
      if (!result.success) {
        const firstError = result.error.issues[0]?.message || "입력 정보를 확인해주세요";
        return res.status(400).json({ error: firstError });
      }

      const { username, password, name, phone, verificationCode, birthYear } = result.data;
      const nickname = (req.body.nickname as string | undefined)?.trim() || undefined;
      const normalizedPhone = phone.replace(/-/g, "");
      const phoneHash = hashPhone(normalizedPhone);

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "이미 사용 중인 아이디입니다" });
      }

      const existingPhone = await storage.getUserByPhoneHash(phoneHash);
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
        nickname: nickname || null,
        phone: normalizedPhone,
        phoneHash,
        birthYear,
        tosAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
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

      // ⚠️ 개발 전용 mock 계정 — 프로덕션에서는 절대 활성화 금지.
      // 활성화하려면 ENABLE_DEV_TESTER=1 환경변수를 명시적으로 설정해야 한다.
      if (
        !isProduction &&
        process.env.ENABLE_DEV_TESTER === "1" &&
        username === "tester" &&
        password === "test1234"
      ) {
        req.session.userId = "mock-tester-id";
        return res.json({
          success: true,
          user: { id: "mock-tester-id", username: "tester", name: "테스터(Mock)" },
        });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" });
      }

      if ((user as any).deletedAt) {
        return res.status(403).json({ error: "탈퇴한 계정입니다" });
      }

      // 소셜(카카오/네이버) 전용 계정은 로컬 비밀번호가 없음(""). 사용자 열거를 피하기
      // 위해 일반 로그인과 동일한 균일 메시지로 거부한다.
      if (!user.password) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" });
      }

      const valid = await comparePasswords(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" });
      }

      req.session.userId = user.id;

      // 세션을 먼저 저장한 뒤 응답 — 클라이언트가 즉시 /api/auth/me 를 호출할 때 세션이 없는 문제 방지
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Login session save error:", saveErr);
          return res.status(500).json({ error: "로그인 중 오류가 발생했습니다" });
        }
        res.json({
          success: true,
          user: { id: user.id, username: user.username, name: user.name },
        });
      });
    } catch (error: any) {
      // 내부 에러 메시지는 서버 로그에만 남기고 클라이언트에는 노출하지 않는다.
      console.error("Login error detail:", error);
      res.status(500).json({ error: "로그인 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!isProduction && req.session.userId === "mock-tester-id") {
      return res.json({
        user: {
          id: "mock-tester-id",
          username: "tester",
          name: "테스터(Mock)",
          voteVerified: false,
          badges: [],
          postCount: 0,
          favorites: [],
          favoriteRegions: [{ code: "11", name: "서울" }],
        },
      });
    }

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
        realNameVerified: user.realNameVerified,
        realName: user.realName,
        nickname: user.nickname,
        // 본인확인 콜백(POST /api/auth/verify-identity)에서 채워지는 demographic 정보
        ageGroup: user.ageGroup,
        gender: user.gender,
        badges,
        postCount: user.postCount,
        favorites: user.favorites,
        favoriteRegions: user.favoriteRegions,
        isAdmin: user.isAdmin ?? false,
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
      const parsed = favoritesUpdateSchema.safeParse(req.body.favorites);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "즐겨찾기 형식이 올바르지 않습니다" });
      }
      const user = await storage.updateUserFavorites(req.session.userId!, parsed.data);
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
          favoriteRegions: user.favoriteRegions,
        },
      });
    } catch (error: any) {
      console.error("Update favorites error:", error);
      res.status(500).json({ error: "즐겨찾기 업데이트 중 오류가 발생했습니다" });
    }
  });

  app.patch("/api/auth/favorite-regions", requireAuth, async (req, res) => {
    try {
      const { regions } = req.body;
      const userId = req.session.userId!;
      
      // 기존 관심 지역 조회 (해제된 지역 언팔로우 처리를 위해)
      const prevUserRows = await db.select({ favoriteRegions: users.favoriteRegions }).from(users).where(eq(users.id, userId)).limit(1);
      const prevRegions: any[] = (prevUserRows[0]?.favoriteRegions as any[]) || [];

      const user = await storage.updateUserFavoriteRegions(userId, regions);

      // --- 자동 팔로우 연동 로직 시작 ---
      const allLegislators = await db.select().from(legislators);

      // 1. 새 지역에 매칭되는 의원들
      const newMatchingLegislators = allLegislators.filter((l) => {
        return regions.some((reg: any) => {
          const regName = reg.name;
          if (!regName) return false;
          return l.district.startsWith(regName) || l.district.includes(regName);
        });
      });

      // 2. 삭제된 지역에 매칭되는 의원들
      const deselectedRegions = prevRegions.filter(
        (prev: any) => !regions.some((curr: any) => curr.code === prev.code)
      );

      if (deselectedRegions.length > 0) {
        const deselectedMatchingLegislators = allLegislators.filter((l) => {
          // 이전 지역엔 있었으나, 현재 지역엔 없는 의원
          const matchesPrev = deselectedRegions.some((reg: any) => {
            const regName = reg.name;
            if (!regName) return false;
            return l.district.startsWith(regName) || l.district.includes(regName);
          });
          const matchesNew = regions.some((reg: any) => {
            const regName = reg.name;
            if (!regName) return false;
            return l.district.startsWith(regName) || l.district.includes(regName);
          });
          return matchesPrev && !matchesNew;
        });

        if (deselectedMatchingLegislators.length > 0) {
          const deselectedMonaCodes = deselectedMatchingLegislators.map((l) => l.monaCd);
          
          const actuallyFollowed = await db
            .select({ politicianId: userFollows.politicianId })
            .from(userFollows)
            .where(and(
              eq(userFollows.userId, userId),
              inArray(userFollows.politicianId, deselectedMonaCodes)
            ));

          if (actuallyFollowed.length > 0) {
            const followedCodes = actuallyFollowed.map((f) => f.politicianId);
            
            await db
              .delete(userFollows)
              .where(and(
                eq(userFollows.userId, userId),
                inArray(userFollows.politicianId, followedCodes)
              ));

            await db
              .update(legislators)
              .set({ followerCount: dsql`GREATEST(${legislators.followerCount} - 1, 0)` })
              .where(inArray(legislators.monaCd, followedCodes));
          }
        }
      }

      // 3. 새 팔로우 처리
      if (newMatchingLegislators.length > 0) {
        const existingFollows = await db
          .select({ politicianId: userFollows.politicianId })
          .from(userFollows)
          .where(eq(userFollows.userId, userId));

        const existingSet = new Set(existingFollows.map((f) => f.politicianId));

        const newLegislatorsToFollow = newMatchingLegislators.filter(
          (l) => !existingSet.has(l.monaCd)
        );

        if (newLegislatorsToFollow.length > 0) {
          const insertValues = newLegislatorsToFollow.map((l) => ({
            userId,
            politicianId: l.monaCd,
            politicianType: "member" as const,
          }));

          await db
            .insert(userFollows)
            .values(insertValues)
            .onConflictDoNothing();

          const newMonaCodes = newLegislatorsToFollow.map((l) => l.monaCd);
          await db
            .update(legislators)
            .set({ followerCount: dsql`${legislators.followerCount} + 1` })
            .where(inArray(legislators.monaCd, newMonaCodes));
        }
      }
      // --- 자동 팔로우 연동 로직 끝 ---

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
          favoriteRegions: user.favoriteRegions,
        },
      });
    } catch (error: any) {
      console.error("Update favorite regions error:", error);
      res.status(500).json({ error: "지역구 즐겨찾기 업데이트 중 오류가 발생했습니다" });
    }
  });

  // ===== 실명인증 (PASS/NICE 등 KISA 지정 본인확인기관 콜백 전용) =====
  // ⚠️ 자체 입력으로 "실명인증"을 부여하는 것은 정보통신망법 §23-2 위반 소지.
  // 이 라우트는 본인확인기관에서 받은 검증된 토큰(공개키 서명 등)을 검증한 뒤에만 verify를 호출하도록 닫혀있다.
  app.post("/api/auth/verify-realname", requireAuth, async (req, res) => {
    try {
      const { provider, providerToken } = req.body as { provider?: string; providerToken?: string };
      const allowedProviders = new Set(["pass", "nice", "kmc"]);
      if (!provider || !allowedProviders.has(provider) || !providerToken) {
        return res.status(400).json({
          error: "본인확인기관(PASS/NICE/KMC) 토큰이 필요합니다. 자체 입력으로는 실명인증할 수 없습니다.",
        });
      }

      // TODO: provider별 서명·토큰 검증 어댑터 연동 필요.
      // 환경변수 SMS_PROVIDER / KMC_API_KEY 등을 통해 SDK 호출 → 응답에서 실명/CI/DI 회수.
      // 현 시점에서는 검증된 통합 없이는 어떠한 사용자도 실명인증을 받을 수 없다.
      return res.status(501).json({
        error: "실명인증 연동이 아직 활성화되지 않았습니다. 운영자에게 문의하세요.",
        provider,
      });
    } catch (error) {
      console.error("Verify realname error:", error);
      res.status(500).json({ error: "실명인증 중 오류가 발생했습니다" });
    }
  });

  // ===== 본인확인 콜백 (PortOne / PASS / Toss 등 인증 성공 후 인적사항 수신) =====
  // 호출 흐름: 클라이언트 위젯이 본인확인기관 인증을 띄움 → 성공 시 콜백/리다이렉트가 이 라우트에
  // {name, birthDate, gender, ci}를 POST. 운영에서는 본인확인기관 응답을 서버측에서 한 번 더 검증해야 함
  // (impUid·txId 등으로 PortOne API 재조회). 본 구현은 스키마/저장 로직 골격 단계.
  app.post("/api/auth/verify-identity", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { name, birthDate, gender, ci } = (req.body ?? {}) as {
        name?: string;
        birthDate?: string;
        gender?: string;
        ci?: string;
      };

      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({ error: "본인확인 응답에 실명이 없습니다." });
      }
      if (!ci || typeof ci !== "string" || ci.trim().length < 8) {
        return res.status(400).json({ error: "본인확인 CI 값이 누락되었습니다." });
      }

      const parsedBirth = parseBirthDate(birthDate);
      if (!parsedBirth) {
        return res.status(400).json({ error: "올바른 생년월일(YYYYMMDD)이 필요합니다." });
      }

      const normalizedGender = normalizeGender(gender);
      if (!normalizedGender) {
        return res.status(400).json({ error: "성별 값이 올바르지 않습니다." });
      }

      const ageGroup = calculateAgeGroup(birthDate);
      if (ageGroup === null) {
        return res.status(400).json({ error: "연령대 계산에 실패했습니다." });
      }

      // ===== CI 유일성 보장: 같은 CI가 다른 계정에 이미 연결되어 있으면 거부 =====
      // 1인 1계정 제약 — 본인확인기관 CI는 동일인 식별값이므로 이미 사용 중이면 중복 가입 시도.
      const normalizedBirth = `${parsedBirth.year}${String(parsedBirth.month).padStart(2, "0")}${String(parsedBirth.day).padStart(2, "0")}`;
      const trimmedCi = ci.trim();

      const [existingCi] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.ci, trimmedCi))
        .limit(1);
      if (existingCi && existingCi.id !== userId) {
        return res.status(409).json({
          error: "이미 다른 계정에 연결된 본인확인 정보입니다. 기존 계정으로 로그인해주세요.",
        });
      }

      // ===== 사용자 레코드 업데이트 =====
      // realNameVerified를 true로 끌어올리는 건 본인확인기관 콜백 처리에서만 허용 (CLAUDE.md 정책).
      const updated = await db
        .update(users)
        .set({
          realName: name.trim(),
          realNameVerified: true,
          realNameProvider: (req.body?.provider as string | undefined)?.toLowerCase() ?? null,
          birthDate: normalizedBirth,
          birthYear: parsedBirth.year,
          gender: normalizedGender,
          ageGroup,
          ci: trimmedCi,
        })
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          birthDate: users.birthDate,
          gender: users.gender,
          ageGroup: users.ageGroup,
          realNameVerified: users.realNameVerified,
        });

      if (updated.length === 0) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }

      console.log(`[verify-identity] user=${userId} ageGroup=${ageGroup} gender=${normalizedGender}`);

      res.json({
        success: true,
        user: updated[0],
      });
    } catch (error: any) {
      // Drizzle/PG: CI unique violation은 23505로 도착. 동시 요청 경합 케이스.
      if (error?.code === "23505") {
        return res.status(409).json({
          error: "이미 다른 계정에 연결된 본인확인 정보입니다.",
        });
      }
      console.error("verify-identity error:", error);
      res.status(500).json({ error: "본인확인 처리 중 오류가 발생했습니다." });
    }
  });

  // ===== 회원 탈퇴 =====
  app.delete("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      await storage.withdrawUser(userId);
      req.session.destroy(() => {
        res.clearCookie("kvg.sid", {
          httpOnly: true,
          secure: isProduction,
          sameSite: isProduction ? "strict" : "lax",
        });
        res.json({ success: true, message: "탈퇴가 완료되었습니다" });
      });
    } catch (error) {
      console.error("Withdraw error:", error);
      res.status(500).json({ error: "탈퇴 처리 중 오류가 발생했습니다" });
    }
  });

  // ===== 닉네임 변경 (7일 제한) =====
  app.patch("/api/users/nickname", requireAuth, async (req, res) => {
    try {
      const { nickname } = req.body;
      if (!nickname || typeof nickname !== "string" || nickname.trim().length < 2 || nickname.trim().length > 20) {
        return res.status(400).json({ error: "닉네임은 2~20자 사이로 입력해주세요" });
      }
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });

      // 7일 제한 체크
      if (user.nicknameUpdatedAt) {
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const nextAvailable = new Date(new Date(user.nicknameUpdatedAt).getTime() + sevenDaysMs);
        if (Date.now() < nextAvailable.getTime()) {
          return res.status(409).json({
            error: "닉네임은 7일에 한 번만 변경할 수 있습니다",
            nextAvailable: nextAvailable.toISOString(),
          });
        }
      }

      const updated = await storage.updateNickname(req.session.userId!, nickname.trim());
      res.json({
        success: true,
        nickname: updated.nickname,
        nicknameUpdatedAt: updated.nicknameUpdatedAt,
      });
    } catch (error) {
      console.error("Update nickname error:", error);
      res.status(500).json({ error: "닉네임 변경 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "로그아웃 중 오류가 발생했습니다" });
      }
      res.clearCookie("kvg.sid", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "strict" : "lax",
      });
      res.json({ success: true });
    });
  });

  // ===== Kakao OAuth (메인 로그인 경로) =====
  // 흐름:
  //   1) FE에서 /api/auth/kakao 로 이동 → CSRF state 생성·세션 저장 → Kakao 인증창 redirect
  //   2) 사용자 동의 후 Kakao가 /api/auth/kakao/callback?code=...&state=... 로 redirect
  //   3) state 검증 → code↔access_token 교환 → /v2/user/me 로 프로필 조회
  //   4) kakaoId로 기존 사용자 찾거나 새로 INSERT (realNameVerified=true)
  //   5) req.session.userId 세팅 → 홈으로 redirect
  // 오픈 리다이렉트 방지 — 같은 origin의 상대 경로만 허용
  function safeNextUrl(raw: unknown): string {
    if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return "/";
    return raw;
  }

  function redirectWithLoginSuccess(res: Response, next: string) {
    const url = new URL(next, "http://localhost");
    url.searchParams.set("loginSuccess", "1");
    res.redirect(url.pathname + url.search);
  }

  // ── 네이티브 앱 소셜 로그인 핸드오프 ──────────────────────────────────────────
  // 시스템 브라우저(Safari)에서 OAuth가 끝나면 세션 쿠키는 Safari 쿠키함에만 생긴다.
  // 앱 웹뷰로 세션을 넘기기 위해, 콜백 성공 시 1회용 코드를 발급해 커스텀 스킴(iyu://)
  // 딥링크로 앱에 전달하고, 앱은 웹뷰에서 /api/auth/native-exchange 로 코드를 교환해
  // 자신의 쿠키 세션을 만든다.
  const NATIVE_AUTH_SCHEME = "iyu://auth";
  const nativeAuthCodes = new Map<string, { userId: string; exp: number }>();
  function issueNativeAuthCode(userId: string): string {
    // 만료된 코드 청소
    const now = Date.now();
    for (const [k, v] of nativeAuthCodes) if (v.exp < now) nativeAuthCodes.delete(k);
    const code = randomBytes(24).toString("hex");
    nativeAuthCodes.set(code, { userId, exp: now + 2 * 60 * 1000 }); // 2분 유효
    return code;
  }
  function finishOAuthLogin(req: Request, res: Response, next: string) {
    if (req.session.oauthNative && req.session.userId) {
      req.session.oauthNative = undefined;
      const code = issueNativeAuthCode(req.session.userId);
      return res.redirect(`${NATIVE_AUTH_SCHEME}?code=${code}`);
    }
    redirectWithLoginSuccess(res, next);
  }

  // 앱 웹뷰가 1회용 코드를 자신의 세션 쿠키로 교환 (Set-Cookie 가 웹뷰 쿠키함에 저장됨)
  app.post("/api/auth/native-exchange", authLimiter, (req, res) => {
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    const entry = code ? nativeAuthCodes.get(code) : undefined;
    if (!entry || entry.exp < Date.now()) {
      if (code) nativeAuthCodes.delete(code);
      return res.status(400).json({ error: "유효하지 않거나 만료된 로그인 코드입니다." });
    }
    nativeAuthCodes.delete(code);
    req.session.userId = entry.userId;
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: "세션 저장 실패" });
      res.json({ success: true });
    });
  });

  // 요청 host에서 동적 redirect URI를 계산 — 로컬 개발과 프로덕션 모두 동작
  function buildDynamicRedirectUri(req: Request, path: string): string {
    const proto = (req.get("x-forwarded-proto") as string) || (req.socket && (req.socket as any).encrypted ? "https" : "http");
    const host = req.get("host") || "localhost:3000";
    return `${proto}://${host}${path}`;
  }

  app.get("/api/auth/kakao", authLimiter, (req, res) => {
    const config = loadKakaoConfig();
    if (!config) {
      return res.status(503).json({
        error: "Kakao 로그인이 설정되지 않았습니다. (KAKAO_REST_API_KEY 환경변수 필요)",
      });
    }
    config.redirectUri = buildDynamicRedirectUri(req, "/api/auth/kakao/callback");
    const state = randomBytes(16).toString("hex");
    req.session.kakaoOAuthState = state;
    req.session.kakaoRedirectUri = config.redirectUri;
    req.session.oauthNext = safeNextUrl(req.query.next);
    req.session.oauthNative = req.query.native === "1";
    const url = buildAuthorizeUrl(config, state);
    req.session.save((err) => {
      if (err) {
        console.error("[kakao] session save failed:", err);
        return res.status(500).json({ error: "세션 저장에 실패했습니다. 다시 시도해주세요." });
      }
      // iOS WKWebView는 외부 도메인 리다이렉션 후 세션 쿠키가 사라질 수 있으므로
      // state를 별도 쿠키에도 저장 (SameSite=None 으로 크로스사이트 리다이렉션에서도 유지)
      const stateHmac = createHmac("sha256", process.env.SESSION_SECRET || "vote-with-reason-dev-secret-key")
        .update(state)
        .digest("hex")
        .slice(0, 16);
      const cookieVal = `${state}.${stateHmac}`;
      const oauthNext = safeNextUrl(req.query.next);
      res.cookie("_kst", cookieVal, {
        maxAge: 10 * 60 * 1000, // 10분
        httpOnly: true,
        secure: isProduction,
        sameSite: "none",
        path: "/api/auth/kakao/callback",
      });
      res.cookie("_krd", config.redirectUri, {
        maxAge: 10 * 60 * 1000,
        httpOnly: true,
        secure: isProduction,
        sameSite: "none",
        path: "/api/auth/kakao/callback",
      });
      res.cookie("_knx", oauthNext, {
        maxAge: 10 * 60 * 1000,
        httpOnly: true,
        secure: isProduction,
        sameSite: "none",
        path: "/api/auth/kakao/callback",
      });
      res.redirect(url);
    });
  });

  app.get("/api/auth/kakao/callback", authLimiter, async (req, res) => {
    const config = loadKakaoConfig();
    if (!config) {
      return res.status(503).send("Kakao 로그인이 설정되지 않았습니다.");
    }

    const { code, state, error: kakaoError } = req.query as Record<string, string | undefined>;
    if (kakaoError) {
      // 사용자가 동의 거부 등 → 로그인 페이지로 돌려보냄
      console.warn(`[kakao] callback error: ${kakaoError}`);
      return res.redirect(`/login?error=${encodeURIComponent(kakaoError)}`);
    }

    if (!code || typeof code !== "string") {
      return res.status(400).send("Kakao 인증 코드가 누락되었습니다.");
    }

    // iOS WKWebView에서 외부 리다이렉션 후 세션이 유실될 수 있으므로
    // 세션의 state OR 쿠키의 state 중 하나라도 일치하면 통과
    const sessionState = req.session.kakaoOAuthState;
    const cookieRaw = (req.cookies as Record<string, string | undefined>)?.["_kst"];
    let cookieStateValid = false;
    if (cookieRaw && state) {
      const [cookieState, cookieSig] = cookieRaw.split(".");
      const expectedSig = createHmac("sha256", process.env.SESSION_SECRET || "vote-with-reason-dev-secret-key")
        .update(cookieState ?? "")
        .digest("hex")
        .slice(0, 16);
      cookieStateValid = cookieState === state && cookieSig === expectedSig;
    }
    const stateValid = (sessionState && sessionState === state) || cookieStateValid;
    if (!stateValid) {
      console.warn("[kakao] state mismatch. session:", sessionState, "cookie valid:", cookieStateValid, "received:", state);
      return res.status(400).send("OAuth state 검증 실패. 다시 로그인해 주세요.");
    }
    req.session.kakaoOAuthState = undefined;
    // 쿠키 정리
    res.clearCookie("_kst", { path: "/api/auth/kakao/callback" });

    // 토큰 교환 시 authorize와 동일한 redirect URI 필요
    const cookieRedirectUri = (req.cookies as Record<string, string | undefined>)?.["_krd"];
    if (req.session.kakaoRedirectUri) {
      config.redirectUri = req.session.kakaoRedirectUri;
      req.session.kakaoRedirectUri = undefined;
    } else if (cookieRedirectUri) {
      config.redirectUri = cookieRedirectUri;
      res.clearCookie("_krd", { path: "/api/auth/kakao/callback" });
    }

    try {
      const tokenRes = await exchangeCodeForToken(config, code);
      // 2) /v2/user/me
      const profile = await fetchKakaoProfile(tokenRes.access_token);

      const kakaoIdStr = String(profile.id);
      const account = profile.kakao_account ?? {};
      const profileNickname = account.profile?.nickname ?? profile.properties?.nickname ?? `kakao_${kakaoIdStr.slice(-6)}`;
      const profileImage = account.profile?.profile_image_url ?? profile.properties?.profile_image ?? null;
      const email = account.email ?? null;
      const ageGroup = mapKakaoAgeRange(account.age_range);
      const gender = mapKakaoGender(account.gender);
      const birthYear = mapKakaoBirthYear(account.birthyear);

      // 3) 사용자 upsert — kakaoId로 lookup
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.kakaoId, kakaoIdStr))
        .limit(1);

      let userId: string;
      if (existing) {
        // 기존 Kakao 사용자 — 최신 정보로 갱신
        userId = existing.id;
        await db
          .update(users)
          .set({
            name: profileNickname,
            email,
            profileImageUrl: profileImage,
            ageGroup: ageGroup ?? undefined,
            gender: gender ?? undefined,
            birthYear: birthYear ?? undefined,
            realNameVerified: true,
            realNameProvider: "kakao",
          })
          .where(eq(users.id, existing.id));
      } else {
        // 신규 Kakao 사용자 — username은 kakao_<id>로 고정 (충돌 가능성 없음)
        const username = `kakao_${kakaoIdStr}`;
        // phone/password는 NOT NULL 컬럼이라 빈 문자열로 표시 (스키마 변경 회피)
        const [created] = await db
          .insert(users)
          .values({
            username,
            password: "",
            phone: "",
            phoneHash: null,
            name: profileNickname,
            email,
            profileImageUrl: profileImage,
            kakaoId: kakaoIdStr,
            ageGroup: ageGroup ?? undefined,
            gender: gender ?? undefined,
            birthYear: birthYear ?? undefined,
            realNameVerified: true,
            realNameProvider: "kakao",
            phoneVerified: false, // Kakao는 phone 인증 아님
            tosAcceptedAt: new Date(),
            privacyAcceptedAt: new Date(),
          })
          .returning({ id: users.id });
        userId = created.id;
      }

      req.session.userId = userId;
      const cookieNext = (req.cookies as Record<string, string | undefined>)?.["_knx"];
      // 신규 사용자는 /welcome (닉네임 설정 온보딩)으로, 기존 사용자는 원래 목적지로
      const requestedNext = safeNextUrl(req.session.oauthNext ?? cookieNext);
      const redirectTarget = !existing ? "/welcome" : requestedNext;
      req.session.oauthNext = undefined;
      res.clearCookie("_knx", { path: "/api/auth/kakao/callback" });
      console.log(`[kakao] login userId=${userId} isNew=${!existing} ageGroup=${ageGroup} gender=${gender}`);
      // 세션을 먼저 저장한 뒤 리디렉션 — 저장 전 redirect 시 브라우저가 세션 없는 상태로 돌아올 수 있음
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("[kakao] session save failed:", saveErr);
          return res.redirect(`/login?error=${encodeURIComponent("세션 저장 실패. 다시 시도해주세요.")}`);
        }
        finishOAuthLogin(req, res, redirectTarget);
      });
    } catch (error: any) {
      console.error("[kakao] callback failed:", error?.response?.data ?? error?.message ?? error);
      res.redirect(`/login?error=${encodeURIComponent("카카오 로그인 처리 중 오류가 발생했습니다.")}`);
    }
  });

  // ===== Google OAuth (보조 로그인 경로) — Kakao/Naver와 동일 흐름 =====
  //   1) FE /api/auth/google → CSRF state 생성·세션 저장 → 구글 인증창 redirect
  //   2) 동의 후 구글이 /api/auth/google/callback?code=...&state=... 로 redirect
  //   3) state 검증 → code↔access_token 교환 → /v2/userinfo 로 프로필 조회
  //   4) googleId로 기존 사용자 찾거나 새로 INSERT (realNameVerified=true)
  //   5) req.session.userId 세팅 → 홈으로 redirect
  app.get("/api/auth/google", authLimiter, (req, res) => {
    const config = loadGoogleConfig();
    if (!config) {
      return res.status(503).json({
        error: "Google 로그인이 설정되지 않았습니다. (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET 환경변수 필요)",
      });
    }
    config.redirectUri = buildDynamicRedirectUri(req, "/api/auth/google/callback");
    const state = randomBytes(16).toString("hex");
    req.session.googleOAuthState = state;
    req.session.googleRedirectUri = config.redirectUri;
    req.session.oauthNext = safeNextUrl(req.query.next);
    req.session.oauthNative = req.query.native === "1";
    req.session.save((err) => {
      if (err) {
        console.error("[google] session save failed:", err);
        return res.status(500).json({ error: "세션 저장에 실패했습니다. 다시 시도해주세요." });
      }
      res.redirect(buildGoogleAuthorizeUrl(config, state));
    });
  });

  app.get("/api/auth/google/callback", authLimiter, async (req, res) => {
    const config = loadGoogleConfig();
    if (!config) {
      return res.status(503).send("Google 로그인이 설정되지 않았습니다.");
    }

    const { code, state, error: googleError } = req.query as Record<string, string | undefined>;
    if (googleError) {
      console.warn(`[google] callback error: ${googleError}`);
      return res.redirect(`/login?error=${encodeURIComponent(googleError)}`);
    }
    if (!code || typeof code !== "string") {
      return res.status(400).send("Google 인증 코드가 누락되었습니다.");
    }
    const expectedState = req.session.googleOAuthState;
    if (!expectedState || expectedState !== state) {
      return res.status(400).send("OAuth state 검증 실패. 다시 로그인해 주세요.");
    }
    req.session.googleOAuthState = undefined;
    if (req.session.googleRedirectUri) {
      config.redirectUri = req.session.googleRedirectUri;
      req.session.googleRedirectUri = undefined;
    }

    try {
      const tokenRes = await exchangeGoogleCodeForToken(config, code);
      const profile = await fetchGoogleProfile(tokenRes.access_token);

      const googleIdStr = String(profile.id);
      const profileNickname = profile.name ?? profile.given_name ?? `google_${googleIdStr.slice(-6)}`;
      const profileImage = profile.picture ?? null;
      const email = profile.email ?? null;

      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.googleId, googleIdStr))
        .limit(1);

      let userId: string;
      if (existing) {
        userId = existing.id;
        await db
          .update(users)
          .set({
            name: profileNickname,
            email,
            profileImageUrl: profileImage,
            realNameVerified: true,
            realNameProvider: "google",
          })
          .where(eq(users.id, existing.id));
      } else {
        const username = `google_${googleIdStr}`;
        const [created] = await db
          .insert(users)
          .values({
            username,
            password: "",
            phone: "",
            phoneHash: null,
            name: profileNickname,
            email,
            profileImageUrl: profileImage,
            googleId: googleIdStr,
            realNameVerified: true,
            realNameProvider: "google",
            phoneVerified: false,
            tosAcceptedAt: new Date(),
            privacyAcceptedAt: new Date(),
          })
          .returning({ id: users.id });
        userId = created.id;
      }

      req.session.userId = userId;
      // 신규 사용자는 /welcome (닉네임 설정 온보딩)으로, 기존 사용자는 원래 목적지로
      const requestedNext = safeNextUrl(req.session.oauthNext);
      const redirectTarget = !existing ? "/welcome" : requestedNext;
      req.session.oauthNext = undefined;
      console.log(`[google] login userId=${userId} isNew=${!existing}`);
      // 세션을 먼저 저장한 뒤 리디렉션
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("[google] session save failed:", saveErr);
          return res.redirect(`/login?error=${encodeURIComponent("세션 저장 실패. 다시 시도해주세요.")}`);
        }
        finishOAuthLogin(req, res, redirectTarget);
      });
    } catch (error: any) {
      console.error("[google] callback failed:", error?.response?.data ?? error?.message ?? error);
      res.redirect(`/login?error=${encodeURIComponent("구글 로그인 처리 중 오류가 발생했습니다.")}`);
    }
  });

  // ===== Sign in with Apple (애플 심사 4.8 필수) — Google/Kakao/Naver와 동일 흐름 =====
  //   1) FE /api/auth/apple → CSRF state 생성·세션 저장 → 애플 인증창 redirect
  //   2) 동의 후 애플이 /api/auth/apple/callback 으로 form_post(POST) — code/state 전달
  //   3) state 검증 → code↔token 교환 → id_token(JWT)을 애플 공개키로 검증 → sub/email 추출
  //   4) appleId(sub)로 기존 사용자 찾거나 새로 INSERT (realNameVerified=true)
  //   5) req.session.userId 세팅 → 홈으로 redirect
  app.get("/api/auth/apple", authLimiter, (req, res) => {
    const config = loadAppleConfig();
    if (!config) {
      return res.status(503).json({
        error: "Apple 로그인이 설정되지 않았습니다. (APPLE_SERVICE_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY 환경변수 필요)",
      });
    }
    config.redirectUri = buildDynamicRedirectUri(req, "/api/auth/apple/callback");
    const state = randomBytes(16).toString("hex");
    req.session.appleOAuthState = state;
    req.session.appleRedirectUri = config.redirectUri;
    req.session.oauthNext = safeNextUrl(req.query.next);
    req.session.oauthNative = req.query.native === "1";
    req.session.save((err) => {
      if (err) {
        console.error("[apple] session save failed:", err);
        return res.status(500).json({ error: "세션 저장에 실패했습니다. 다시 시도해주세요." });
      }
      res.redirect(buildAppleAuthorizeUrl(config, state));
    });
  });

  // 애플은 scope 요청 시 콜백을 form_post(POST)로 보낸다 → urlencoded 파싱 필요.
  app.post(
    "/api/auth/apple/callback",
    authLimiter,
    express.urlencoded({ extended: false }),
    async (req, res) => {
      const config = loadAppleConfig();
      if (!config) return res.status(503).send("Apple 로그인이 설정되지 않았습니다.");

      const { code, state, error: appleError } = req.body as Record<string, string | undefined>;
      if (appleError) {
        console.warn(`[apple] callback error: ${appleError}`);
        return res.redirect(`/login?error=${encodeURIComponent(appleError)}`);
      }
      if (!code || typeof code !== "string") {
        return res.status(400).send("Apple 인증 코드가 누락되었습니다.");
      }
      const expectedState = req.session.appleOAuthState;
      if (!expectedState || expectedState !== state) {
        return res.status(400).send("OAuth state 검증 실패. 다시 로그인해 주세요.");
      }
      req.session.appleOAuthState = undefined;
      if (req.session.appleRedirectUri) {
        config.redirectUri = req.session.appleRedirectUri;
        req.session.appleRedirectUri = undefined;
      }

      try {
        const tokenRes = await exchangeAppleCodeForToken(config, code);
        const profile = await verifyAppleIdToken(config, tokenRes.id_token);

        const appleIdStr = profile.sub;
        const email = profile.email ?? null;
        // 애플은 이름을 최초 1회 form_post의 user 필드(JSON)로만 보낸다. 있으면 활용.
        let profileNickname = `apple_${appleIdStr.slice(-6)}`;
        const userField = (req.body as Record<string, string | undefined>).user;
        if (userField) {
          try {
            const parsed = JSON.parse(userField) as { name?: { firstName?: string; lastName?: string } };
            const full = `${parsed.name?.lastName ?? ""}${parsed.name?.firstName ?? ""}`.trim();
            if (full) profileNickname = full;
          } catch { /* user 파싱 실패 시 기본 닉네임 유지 */ }
        }

        const [existing] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.appleId, appleIdStr))
          .limit(1);

        let userId: string;
        if (existing) {
          userId = existing.id;
          await db
            .update(users)
            .set({
              email,
              realNameVerified: true,
              realNameProvider: "apple",
            })
            .where(eq(users.id, existing.id));
        } else {
          const username = `apple_${appleIdStr}`;
          const [created] = await db
            .insert(users)
            .values({
              username,
              password: "",
              phone: "",
              phoneHash: null,
              name: profileNickname,
              email,
              appleId: appleIdStr,
              realNameVerified: true,
              realNameProvider: "apple",
              phoneVerified: false,
              tosAcceptedAt: new Date(),
              privacyAcceptedAt: new Date(),
            })
            .returning({ id: users.id });
          userId = created.id;
        }

        req.session.userId = userId;
        const next = safeNextUrl(req.session.oauthNext);
        req.session.oauthNext = undefined;
        console.log(`[apple] login userId=${userId}`);
        finishOAuthLogin(req, res, next);
      } catch (error: any) {
        console.error("[apple] callback failed:", error?.response?.data ?? error?.message ?? error);
        res.redirect(`/login?error=${encodeURIComponent("애플 로그인 처리 중 오류가 발생했습니다.")}`);
      }
    },
  );

  // ===== Apple Native Sign In (expo-apple-authentication) =====
  // 네이티브 앱에서 identityToken(JWT)을 직접 받아 검증 후 세션 발급.
  // audience = Bundle ID (com.coalfireant.antigravity), web OAuth와 다름.
  app.post("/api/auth/apple/native", authLimiter, async (req, res) => {
    const { identityToken, fullName } = req.body as {
      identityToken?: string;
      fullName?: { familyName?: string | null; givenName?: string | null } | null;
    };
    if (!identityToken || typeof identityToken !== "string") {
      return res.status(400).json({ error: "identityToken이 누락되었습니다." });
    }
    const BUNDLE_ID = "com.antigravity.iyu";
    try {
      const { jwtVerify, createRemoteJWKSet } = await import("jose");
      const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
      const { payload } = await jwtVerify(identityToken, appleJwks, {
        issuer: "https://appleid.apple.com",
        audience: BUNDLE_ID,
      });
      const appleIdStr = String(payload.sub);
      const email = typeof payload.email === "string" ? payload.email : null;
      let nickname = `apple_${appleIdStr.slice(-6)}`;
      if (fullName) {
        const full = `${fullName.familyName ?? ""}${fullName.givenName ?? ""}`.trim();
        if (full) nickname = full;
      }
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.appleId, appleIdStr))
        .limit(1);
      let userId: string;
      if (existing) {
        userId = existing.id;
        await db.update(users).set({ email, realNameVerified: true, realNameProvider: "apple" }).where(eq(users.id, existing.id));
      } else {
        const [created] = await db.insert(users).values({
          username: `apple_${appleIdStr}`,
          password: "",
          phone: "",
          phoneHash: null,
          name: nickname,
          email,
          appleId: appleIdStr,
          realNameVerified: true,
          realNameProvider: "apple",
          phoneVerified: false,
          tosAcceptedAt: new Date(),
          privacyAcceptedAt: new Date(),
        }).returning({ id: users.id });
        userId = created.id;
      }
      req.session.userId = userId;
      req.session.save((err) => {
        if (err) return res.status(500).json({ error: "세션 저장 실패" });
        res.json({ ok: true });
      });
    } catch (error: any) {
      console.error("[apple/native]", error?.message ?? error);
      res.status(401).json({ error: "Apple 인증 토큰 검증에 실패했습니다." });
    }
  });

  app.get("/api/candidates/:id/rating", async (req, res) => {
    try {
      const { id } = req.params;
      const { candidateRatings } = await import("@shared/schema");
      const userId = req.session?.userId;

      const ratings = await db.select().from(candidateRatings)
        .where(eq(candidateRatings.candidateId, id));

      const avg = ratings.length > 0 ? ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length : 0;
      const myRating = userId ? ratings.find(r => r.userId === userId)?.rating : null;

      res.json({ average: avg, totalCount: ratings.length, myRating });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/candidates/rate", requireAuth, async (req, res) => {
    try {
      const { candidateId, rating } = req.body;
      const userId = req.session.userId!;
      const { candidateRatings } = await import("@shared/schema");

      if (!candidateId || typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "잘못된 요청입니다" });
      }

      await db.insert(candidateRatings).values({
        candidateId,
        userId,
        rating
      }).onConflictDoUpdate({
        target: [candidateRatings.candidateId, candidateRatings.userId],
        set: { rating }
      });

      res.json({ success: true, candidateId, rating });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
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

  let memberListCache: { payload: any; cachedAt: number } | null = null;
  const MEMBER_LIST_TTL = 5 * 60 * 1000;

  app.get("/api/members", async (_req, res) => {
    try {
      if (memberListCache && Date.now() - memberListCache.cachedAt < MEMBER_LIST_TTL) {
        return res.json(memberListCache.payload);
      }
      // DB에 데이터가 있으면 우선 사용 (빠름)
      const dbRows = await db.select().from(legislators).orderBy(legislators.name).limit(400);
      if (dbRows.length > 0) {
        const payload = { source: "db", data: dbRows };
        memberListCache = { payload, cachedAt: Date.now() };
        return res.json(payload);
      }
      // DB 없으면 전체 페이지 API 조회
      const { syncLegislators: sync } = await import("./api-sync");
      await sync();
      const freshRows = await db.select().from(legislators).orderBy(legislators.name).limit(400);
      const payload = { source: "api", data: freshRows };
      memberListCache = { payload, cachedAt: Date.now() };
      return res.json(payload);
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

  app.post("/api/admin/fix-photos", requireAdmin, async (_req, res) => {
    try {
      const membersMissingPhoto = await db.select().from(legislators).where(eq(legislators.photoUrl, "")).limit(400);
      let fixedCount = 0;

      console.log(`[admin] Fixing photos for ${membersMissingPhoto.length} members...`);

      for (const m of membersMissingPhoto) {
        const context = [m.party, m.district, "국회의원"].filter(Boolean).join(" ");
        const photoUrl = await getPoliticianPhotoUrl(m.name, context);
        if (photoUrl) {
          await db.update(legislators).set({ photoUrl }).where(eq(legislators.monaCd, m.monaCd));
          fixedCount++;
        }
      }

      res.json({ success: true, fixedCount, totalMissing: membersMissingPhoto.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 전체 의원 사진을 정당+지역구 컨텍스트로 재수집 (동명이인 수정용)
  app.post("/api/admin/resync-photos", requireAdmin, async (_req, res) => {
    try {
      const allMembers = await db
        .select({ monaCd: legislators.monaCd, name: legislators.name, party: legislators.party, district: legislators.district })
        .from(legislators)
        .limit(400);

      // 캐시 무효화: context 없이 저장된 기존 잘못된 사진 캐시 제거
      const { politicianPhotoCache } = await import("@shared/schema");
      const { notLike } = await import("drizzle-orm");
      await db.delete(politicianPhotoCache).where(notLike(politicianPhotoCache.name, "%::%"));

      let updated = 0;
      for (const m of allMembers) {
        const context = [m.party, m.district, "국회의원"].filter(Boolean).join(" ");
        const photoUrl = await getPoliticianPhotoUrl(m.name, context);
        if (photoUrl) {
          await db.update(legislators).set({ photoUrl }).where(eq(legislators.monaCd, m.monaCd));
          updated++;
        }
        // 과부하 방지
        await new Promise((r) => setTimeout(r, 300));
      }

      res.json({ success: true, updated, total: allMembers.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===== 최근에 대표발의한 의원들 (최근 활동 의원) =====
  app.get("/api/members/active", async (_req, res) => {
    try {
      // 1. 최근 발의된 법안 30개 가져오기
      const recentBills = await db.select()
        .from(assemblyBills)
        .orderBy(desc(assemblyBills.proposeDate))
        .limit(30);

      // 2. 대표발의자 추출 및 법안 정보 매핑
      // PROPOSER 형식: "홍길동(국민의힘/洪吉童) 외 10인"
      type BillMeta = {
        billName: string;
        billId: string;
        proposeDate: string;
        aiDescription: string | null;
        committee: string;
      };
      const proposerMap = new Map<string, BillMeta>();
      recentBills.forEach(bill => {
        if (bill.proposer) {
          const primaryProposer = bill.proposer.split('(')[0].split(',')[0].trim();
          if (primaryProposer && !proposerMap.has(primaryProposer)) {
            proposerMap.set(primaryProposer, {
              billName: bill.billName,
              billId: bill.billId,
              proposeDate: bill.proposeDate,
              // aiDescription: 법안 본문을 AI가 평이하게 풀어쓴 요약. null이면 UI에서 폴백 처리.
              aiDescription: bill.aiDescription ?? null,
              committee: bill.committee ?? "",
            });
          }
        }
      });

      const proposerNames = Array.from(proposerMap.keys());
      if (proposerNames.length === 0) return res.json([]);

      // 3. 해당 의원들의 상세 정보 조회
      const memberDetails = await db.select()
        .from(legislators)
        .where(inArray(legislators.name, proposerNames));

      const result = memberDetails.map(member => {
        const bill = proposerMap.get(member.name);
        return {
          id: member.monaCd,
          name: member.name,
          party: member.party,
          district: member.district,
          photo: member.photoUrl,
          recentBill: bill?.billName,
          recentBillDescription: bill?.aiDescription ?? null,
          recentBillCommittee: bill?.committee ?? "",
          billId: bill?.billId,
          proposeDate: bill?.proposeDate,
        };
      });

      // 4. 발의 날짜순으로 재정렬
      result.sort((a, b) => (b.proposeDate || "").localeCompare(a.proposeDate || ""));

      res.json(result.slice(0, 5));
    } catch (error: any) {
      console.error("[members/active] 오류:", error.message);
      res.status(500).json({ error: "최근 활동 의원 조회 중 오류가 발생했습니다" });
    }
  });

  // ===== 최근 주목받는 의원 (Trending Score 기반 DB 랭킹) =====
  // Trending Score = follower_count*20 + profile_view_count*1 + recent_news_count*5
  // TODO: Cron으로 follower_count / profile_view_count / recent_news_count를 주기적으로 갱신할 것.
  //       지금은 컬럼만 정의돼 있고 기록만 들어오면 즉시 랭킹에 반영된다.
  app.get("/api/trending-members", async (_req, res) => {
    try {
      const trendingScore = dsql`(${legislators.followerCount} * 20 + ${legislators.profileViewCount} * 1 + ${legislators.recentNewsCount} * 5)`;

      const rows = await db.select({
        id: legislators.monaCd,
        name: legislators.name,
        party: legislators.party,
        district: legislators.district,
        photo: legislators.photoUrl,
        committee: legislators.committee,
        followerCount: legislators.followerCount,
        profileViewCount: legislators.profileViewCount,
        recentNewsCount: legislators.recentNewsCount,
        score: trendingScore,
      })
        .from(legislators)
        .orderBy(desc(trendingScore), desc(legislators.syncedAt))
        .limit(5);

      // primary keyword: 위원회 > 정당 fallback
      const data = rows.map((r) => ({
        ...r,
        primaryKeyword: (r.committee && r.committee.trim()) || r.party,
        // 기존 위젯 호환 필드
        mentionCount: r.recentNewsCount,
        recentBills: 0,
      }));

      res.json({ success: true, data, cachedAt: new Date().toISOString() });
    } catch (err: any) {
      console.error("[trending-members] 오류:", err.message);
      res.status(500).json({ success: false, error: "주목 의원 조회 중 오류가 발생했습니다", data: [] });
    }
  });

  // 관리자용: 캐시 수동 갱신 (legacy 크롤러 캐시 유지 — 다른 진단/디버그용)
  app.post("/api/trending-members/refresh", requireAdmin, async (_req, res) => {
    try {
      clearTrendingMembersCache();
      const data = await getTrendingMembersWithCache();
      res.json({ success: true, count: data.length, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 리스트 소비처(useAssemblyBills→bill-search)는 6개 필드만 사용. 무거운 aiDescription
  // 등 미사용 컬럼을 제외해 1000행 페이로드를 대폭 축소 + 5분 메모리 캐시로 반복 풀스캔 제거.
  const billListCols = {
    billId: assemblyBills.billId,
    billName: assemblyBills.billName,
    committee: assemblyBills.committee,
    proposeDate: assemblyBills.proposeDate,
    proposer: assemblyBills.proposer,
    result: assemblyBills.result,
  };
  let billListCache: { payload: any; cachedAt: number } | null = null;
  const BILL_LIST_TTL = 5 * 60 * 1000;

  app.get("/api/bills", async (_req, res) => {
    try {
      if (billListCache && Date.now() - billListCache.cachedAt < BILL_LIST_TTL) {
        return res.json(billListCache.payload);
      }
      // DB에 데이터가 있으면 우선 사용
      const dbRows = await db.select(billListCols).from(assemblyBills).orderBy(desc(assemblyBills.proposeDate)).limit(1000);
      if (dbRows.length > 0) {
        const payload = { source: "db", data: dbRows };
        billListCache = { payload, cachedAt: Date.now() };
        return res.json(payload);
      }
      // DB 없으면 전체 페이지 API 조회
      const { syncBills: sync } = await import("./api-sync");
      await sync();
      const freshRows = await db.select(billListCols).from(assemblyBills).orderBy(desc(assemblyBills.proposeDate)).limit(1000);
      const payload = { source: "api", data: freshRows };
      billListCache = { payload, cachedAt: Date.now() };
      return res.json(payload);
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
      // 캐시 없으면 백그라운드에서 동기화 트리거 후 즉시 mock 반환 (블로킹 방지)
      if (!OPEN_API_KEY) {
        return res.json({ source: "mock", data: null });
      }

      fetchAssemblyData().catch((error) => {
        console.error("[background-sync] fetchAssemblyData (attendance) error:", error);
      });

      return res.json({ source: "mock", data: null, message: "syncing" });
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

  // 개발 환경에서는 인증 없이 sync 허용
  const syncGuard = isProduction ? requireAdmin : (_req: any, _res: any, next: any) => next();

  app.post("/api/sync", syncGuard, async (_req, res) => {
    try {
      const result = await syncAll();
      res.json({ ok: true, result });
    } catch (error: any) {
      res.status(500).json({ error: `동기화 실패: ${error.message}` });
    }
  });

  app.post("/api/sync/legislators", syncGuard, async (_req, res) => {
    try {
      const result = await syncLegislators();
      res.json({ ok: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sync/bills", syncGuard, async (_req, res) => {
    // 즉시 응답 후 백그라운드 실행 (법안 수천건 처리 시간 초과 방지)
    res.json({ ok: true, message: "법안 동기화 백그라운드 시작. /api/sync/bills/status 로 진행상황 확인" });
    syncBills().then(r => console.log(`[sync/bills] 완료: ${r.synced}건, 오류: ${r.errors.length}건`))
               .catch(e => console.error("[sync/bills] 실패:", e.message));
  });

  app.get("/api/sync/bills/status", syncGuard, async (_req, res) => {
    try {
      const { count } = await import("drizzle-orm");
      const rows = await db.select({ cnt: count() }).from(assemblyBills);
      res.json({ billCount: rows[0]?.cnt ?? 0 });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/sync/votes", syncGuard, async (_req, res) => {
    res.json({ ok: true, message: "표결 동기화 백그라운드 시작" });
    syncVotes().then(r => console.log(`[sync/votes] 완료: ${r.synced}건`))
               .catch(e => console.error("[sync/votes] 실패:", e.message));
  });


  app.get("/api/db/legislators", async (_req, res) => {
    try {
      const rows = await db.select().from(legislators).orderBy(legislators.name).limit(400);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== 의원 상세 정보 (선관위 22대 총선 데이터 포함) =====
  // 메모리 캐시: 24시간 TTL (선관위 데이터는 자주 안 바뀜)
  const legislatorDetailCache = new Map<string, { data: any; cachedAt: number }>();
  const LEGISLATOR_DETAIL_CACHE_TTL = 24 * 60 * 60 * 1000;

  app.get("/api/legislators/:id/detail", async (req, res) => {
    try {
      const { id } = req.params;

      // 캐시 확인
      const cached = legislatorDetailCache.get(id);
      if (cached && Date.now() - cached.cachedAt < LEGISLATOR_DETAIL_CACHE_TTL) {
        return res.json({ source: "cache", data: cached.data });
      }

      // DB에서 의원 기본 + 선관위 상세 데이터 조회
      const rows = await db
        .select()
        .from(legislators)
        .where(eq(legislators.monaCd, id))
        .limit(1);

      if (rows.length === 0) {
        return res.status(404).json({ error: "의원을 찾을 수 없습니다." });
      }

      const row = rows[0];

      // 선관위 데이터가 아직 없으면 실시간 단건 조회 시도 (비동기, 응답은 먼저 보냄)
      const hasNecData = !!row.necDetailSyncedAt;

      const detail = {
        monaCd: row.monaCd,
        name: row.name,
        party: row.party,
        district: row.district,
        photoUrl: row.photoUrl || "",
        committee: row.committee,
        electedTerm: row.electedTerm,
        // 선관위 데이터 (없으면 fallback)
        propertyAmount: row.propertyAmount ?? "정보 없음",
        education: row.education ?? "정보 없음",
        criminalRecord: row.criminalRecord ?? null,    // null = 전과 없음
        criminalCount: row.criminalCount ?? 0,
        career: row.career ?? "",
        necDetailSyncedAt: row.necDetailSyncedAt ?? null,
        // 국회 API 추가 필드
        email: row.email ?? null,
        telNo: (row as any).telNo ?? null,
        homepage: row.homepage ?? null,
        twitter: row.twitter ?? null,
        facebook: row.facebook ?? null,
        youtube: row.youtube ?? null,
        blog: row.blog ?? null,
        instagram: (row as any).instagram ?? null,
        birthDate: (row as any).birthDate ?? null,
        gender: (row as any).gender ?? null,
        reelectionGbn: (row as any).reelectionGbn ?? null,
        committees: (row as any).committees ?? null,
        memTitle: (row as any).memTitle ?? null,
        assemblyAddr: (row as any).assemblyAddr ?? null,
        // 공직자윤리위원회 재산 상세
        propertyLand: row.propertyLand ?? null,
        propertyBuilding: row.propertyBuilding ?? null,
        propertyDeposit: row.propertyDeposit ?? null,
        propertyStock: row.propertyStock ?? null,
        propertyDebt: row.propertyDebt ?? null,
        propertyDetailSyncedAt: row.propertyDetailSyncedAt ?? null,
      };

      legislatorDetailCache.set(id, { data: detail, cachedAt: Date.now() });
      return res.json({ source: "db", data: detail, hasNecData });
    } catch (error: any) {
      console.error("[legislators/detail] 오류:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/legislators/:id/alumni", async (req, res) => {
    try {
      const { id } = req.params;
      const rows = await db.select().from(legislators).where(eq(legislators.monaCd, id)).limit(1);
      if (rows.length === 0) return res.status(404).json({ error: "의원을 찾을 수 없습니다." });

      const education = rows[0].education;
      if (!education || education === "정보 없음") return res.json([]);

      // 대학교 이름 추출 (예: 연세대학교)
      const uniMatch = education.match(/([가-힣]+대학교)/);
      if (!uniMatch) return res.json([]);
      const university = uniMatch[1];

      // 같은 학교 출신 다른 의원들 검색 (최대 10명)
      const alumni = await db.select()
        .from(legislators)
        .where(
          and(
            like(legislators.education, `%${university}%`),
            notInArray(legislators.monaCd, [id])
          )
        )
        .limit(10);

      res.json({ university, alumni });
    } catch (error: any) {
      console.error("[legislators/alumni] 오류:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // 선관위 22대 총선 데이터 → legislators 테이블 동기화 트리거
  app.post("/api/sync/legislators/nec-detail", syncGuard, async (_req, res) => {
    res.json({ ok: true, message: "선관위 22대 총선 상세정보 동기화를 백그라운드로 시작합니다." });
    // 완료 후 캐시 초기화
    const { syncNec22ndDetailsToLegislators } = await import("./nec-sync");
    syncNec22ndDetailsToLegislators()
      .then((result) => {
        legislatorDetailCache.clear();
        console.log(
          `[sync/nec-detail] 완료: ${result.synced}명 갱신, ` +
          `매핑 실패 ${result.notFound.length}명, 오류 ${result.errors.length}건, ` +
          `학력 추가보강 ${result.eduFilled}명, 학력 끝까지 미보유 ${result.eduStillMissing.length}명`
        );
      })
      .catch((e) => console.error("[sync/nec-detail] 실패:", e.message));
  });

  // 선관위 동기화 상태 확인
  app.get("/api/sync/legislators/nec-detail/status", syncGuard, async (_req, res) => {
    try {
      // necDetailSyncedAt이 있는 의원 수 집계
      const rows = await db
        .select({ cnt: legislators.monaCd, syncedAt: legislators.necDetailSyncedAt })
        .from(legislators);
      const total = rows.length;
      const synced = rows.filter((r) => !!r.syncedAt).length;
      const lastSyncedAt = rows
        .filter((r) => !!r.syncedAt)
        .map((r) => r.syncedAt as Date)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      res.json({ total, synced, notSynced: total - synced, lastSyncedAt });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 공직자윤리위원회 재산 상세 동기화
  app.post("/api/sync/legislators/repa", syncGuard, async (_req, res) => {
    res.json({ ok: true, message: "공직자윤리위원회 재산 상세 동기화를 백그라운드로 시작합니다." });
    const { syncRepaPropertyDetails } = await import("./repa-sync");
    syncRepaPropertyDetails()
      .then((result) => {
        legislatorDetailCache.clear();
        console.log(`[sync/repa] 완료: ${result.synced}명 갱신, 실패 ${result.failed}명`);
      })
      .catch((e) => console.error("[sync/repa] 실패:", e.message));
  });

  app.get("/api/sync/legislators/repa/status", syncGuard, async (_req, res) => {
    try {
      const rows = await db.select({ cnt: legislators.monaCd, syncedAt: legislators.propertyDetailSyncedAt }).from(legislators);
      const total = rows.length;
      const synced = rows.filter(r => !!r.syncedAt).length;
      res.json({ total, synced, notSynced: total - synced });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });



  const viewCountCache = new Map<string, number>();

  // 0. 오늘 발의된 법안 수 (GET /api/bills/today-count)
  // propose_date는 YYYY-MM-DD 텍스트라 KST 기준 오늘 날짜로 동등 비교한다.
  app.get("/api/bills/today-count", async (_req, res) => {
    try {
      const todayKST = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
      const rows = await db.select({ count: count() })
        .from(assemblyBills)
        .where(eq(assemblyBills.proposeDate, todayKST));
      res.json({ date: todayKST, count: rows[0]?.count ?? 0 });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 1. 핫한 법안 (GET /api/bills/hot)
  // ═══════════════════════════════════════════════════════════════════════
  // Trending Score Algorithm:
  //   engagement = (view_count * 1) + (vote_count * 5) + (media_mention_count * 10)
  //   political  = co_proposer_count * 2
  //   comments   = bill_comment_count * 3
  //   recencyPenalty = days_since_proposal * 0.5
  //   trendingScore  = engagement + political + comments - recencyPenalty
  //
  // Cold Start: 모든 engagement가 0이면 hot-topic 키워드 필터링 후 최신순으로 폴백.
  // ═══════════════════════════════════════════════════════════════════════
  app.get("/api/bills/hot", async (_req, res) => {
    try {
      // ── 1. Trending Score SQL 식 ──
      const trendingScore = dsql<number>`(
        COALESCE(${assemblyBills.viewCount}, 0) * 1
        + COALESCE(${assemblyBills.voteCount}, 0) * 5
        + COALESCE(${assemblyBills.mediaMentionCount}, 0) * 10
        + COALESCE(${assemblyBills.coProposerCount}, 0) * 2
        - GREATEST(
            EXTRACT(EPOCH FROM (NOW() - TO_TIMESTAMP(
              NULLIF(${assemblyBills.proposeDate}, ''), 'YYYY-MM-DD'
            ))) / 86400.0 * 0.5,
            0
          )
      )`.as("trending_score");

      // ── 2. 심사 중인 법안만 대상 (이미 종결된 법안 제외) ──
      const excludedStatuses = ["가결", "부결", "폐기", "철회", "통과", "공포", "시행"];

      const rows = await db
        .select({
          billId: assemblyBills.billId,
          billNo: assemblyBills.billNo,
          billName: assemblyBills.billName,
          proposer: assemblyBills.proposer,
          proposeDate: assemblyBills.proposeDate,
          result: assemblyBills.result,
          committee: assemblyBills.committee,
          yesCount: assemblyBills.yesCount,
          noCount: assemblyBills.noCount,
          abstainCount: assemblyBills.abstainCount,
          viewCount: assemblyBills.viewCount,
          voteCount: assemblyBills.voteCount,
          newsMentionCount: assemblyBills.newsMentionCount,
          coProposerCount: assemblyBills.coProposerCount,
          mediaMentionCount: assemblyBills.mediaMentionCount,
          category: assemblyBills.category,
          aiDescription: assemblyBills.aiDescription,
          trendingScore,
        })
        .from(assemblyBills)
        .where(notInArray(assemblyBills.result, excludedStatuses))
        .orderBy(desc(trendingScore), desc(assemblyBills.proposeDate))
        .limit(10);

      // ── 3. Cold-start 감지: 모든 engagement 지표가 0인지 확인 ──
      const allZero = rows.every(
        (b) =>
          (b.viewCount ?? 0) === 0 &&
          (b.voteCount ?? 0) === 0 &&
          (b.mediaMentionCount ?? 0) === 0 &&
          (b.coProposerCount ?? 0) === 0
      );

      let finalRows: any[] = rows;

      if (allZero) {
        // Cold Start Fallback: 국민 관심 키워드로 필터링 후 최신순
        const hotKeywords = [
          "부동산", "세금", "청년", "지원금", "처벌", "성범죄", "학대",
          "임금", "노동", "의료", "건강보험", "연금", "교육", "주거",
          "디지털", "AI", "반도체", "기후", "에너지", "안전", "군사",
          "국방", "외교", "통일", "재난", "소방", "경찰", "검찰",
        ];
        const keywordConditions = hotKeywords.map((kw) =>
          ilike(assemblyBills.billName, `%${kw}%`)
        );

        const coldStartRows = await db
          .select()
          .from(assemblyBills)
          .where(
            and(
              notInArray(assemblyBills.result, excludedStatuses),
              or(...keywordConditions)
            )
          )
          .orderBy(desc(assemblyBills.proposeDate))
          .limit(10);

        // 키워드 매칭이 하나도 없으면 최종 폴백: 그냥 최신순
        finalRows =
          coldStartRows.length > 0
            ? coldStartRows.map((b) => ({ ...b, trendingScore: 0 }))
            : await db
                .select()
                .from(assemblyBills)
                .where(notInArray(assemblyBills.result, excludedStatuses))
                .orderBy(desc(assemblyBills.proposeDate))
                .limit(10)
                .then((r) => r.map((b) => ({ ...b, trendingScore: 0 })));
      }

      // ── 4. 법안명 누락 보충 (국회 단건 조회) ──
      const rowsWithNames = await Promise.all(
        finalRows.map(async (bill: any) => {
          if (bill.billName && bill.billName.trim() !== "") return bill;
          try {
            const apiKey =
              process.env.OPEN_ASSEMBLY_API_KEY ||
              process.env.ASSEMBLY_API_KEY;
            if (!apiKey) return bill;
            const resp = await axios.get(
              "https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn",
              {
                params: {
                  Key: apiKey,
                  Type: "json",
                  AGE: "22",
                  BILL_ID: bill.billId,
                  pIndex: 1,
                  pSize: 1,
                },
                timeout: 5000,
              }
            );
            const serviceData = resp.data?.nzmimeepazxkubdpn;
            const row = serviceData?.[1]?.row?.[0];
            if (row?.BILL_NAME || row?.BILL_NM) {
              const billName = row.BILL_NAME || row.BILL_NM;
              const committee =
                row.COMMITTEE_NM || row.COMMITTEE || bill.committee || "";
              const proposer =
                row.PROPOSER || row.RST_PROPOSER || bill.proposer || "";
              db.update(assemblyBills)
                .set({ billName, committee, proposer })
                .where(eq(assemblyBills.billId, bill.billId))
                .catch(() => {});
              return { ...bill, billName, committee, proposer };
            }
          } catch {}
          return bill;
        })
      );

      // ── 5. 법안명 키워드로 관련 뉴스 매칭 ──
      const NEWS_STOPWORDS = new Set([
        "관한", "법률", "법안", "개정", "일부", "전부", "제정", "특례", "위한",
        "관련", "및", "등", "에", "의", "을", "를", "이", "가", "로", "으로",
        "시행", "촉진", "지원", "육성", "강화", "보호", "설치", "운영", "확보",
      ]);
      function extractBillKeywords(name: string): string[] {
        return (name ?? "")
          .replace(/일부개정법률안|전부개정법률안|제정법률안|법률안|법안|개정안/g, "")
          .replace(/에 관한.*$/g, "")
          .split(/[\s·,]+/)
          .map((w) => w.trim())
          .filter((w) => w.length >= 2 && !NEWS_STOPWORDS.has(w));
      }
      const cachedNewsItems = newsCache?.items ?? [];
      const withNews = rowsWithNames.map((bill: any) => {
        if (!bill.billName || cachedNewsItems.length === 0) return { ...bill, matchedNews: [] };
        const kws = extractBillKeywords(bill.billName);
        if (kws.length === 0) return { ...bill, matchedNews: [] };
        const matched = cachedNewsItems
          .filter((n) => kws.some((kw) => n.title.includes(kw)))
          .slice(0, 3)
          .map((n) => ({
            title: n.title,
            link: n.link,
            source: n.source,
            sourceCode: n.sourceCode,
            pubDate: n.pubDate,
          }));
        return { ...bill, matchedNews: matched };
      });

      res.json(withNews);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });



  // 2. 생활밀착 법안 (GET /api/bills/daily-life)
  app.get("/api/bills/daily-life", async (_req, res) => {
    try {
      const keywords = ['주거', '임대', '교육', '의료', '건강', '육아', '보육', '노동', '임금', '세금', '교통', '환경', '식품', '안전', '소비자', '청년', '노인', '복지', '금융', '부동산', '통신', '에너지'];
      const searchConditions = keywords.map(kw => or(ilike(assemblyBills.billName, `%${kw}%`), ilike(assemblyBills.category, `%${kw}%`)));

      const rows = await db.select()
        .from(assemblyBills)
        .where(
          and(
            notInArray(assemblyBills.result, ["폐기", "부결", "철회"]),
            or(...searchConditions)
          )
        )
        .orderBy(desc(assemblyBills.proposeDate))
        .limit(10);
      
      // Fallback
      if (rows.length === 0) {
        const fallback = await db.select()
          .from(assemblyBills)
          .where(notInArray(assemblyBills.result, ["폐기", "부결", "철회"]))
          .orderBy(desc(assemblyBills.proposeDate))
          .limit(10);
        return res.json(fallback);
      }

      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 3. 통과 법안 (GET /api/bills/passed)
  app.get("/api/bills/passed", async (req, res) => {
    try {
      const page = parseInt((req.query.page as string) || "1", 10);
      const limit = parseInt((req.query.limit as string) || "10", 10);
      const offset = (page - 1) * limit;

      const rows = await db.select()
        .from(assemblyBills)
        .where(inArray(assemblyBills.result, ["가결", "통과", "공포", "시행"]))
        .orderBy(desc(assemblyBills.proposeDate))
        .limit(limit)
        .offset(offset);
      
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 3-2. 심사중인 법안 (GET /api/bills/reviewing)
  app.get("/api/bills/reviewing", async (req, res) => {
    try {
      const page = parseInt((req.query.page as string) || "1", 10);
      const limit = parseInt((req.query.limit as string) || "10", 10);
      const offset = (page - 1) * limit;

      // 계류 중 = result가 비어있거나 '계류' / '소관위심사' / '법제사법위원회' 등 심사중인 상태
      const rows = await db.select()
        .from(assemblyBills)
        .where(
          and(
            notInArray(assemblyBills.result, ["가결", "부결", "폐기", "철회", "통과", "공포", "시행"]),
          )
        )
        .orderBy(desc(assemblyBills.proposeDate))
        .limit(limit)
        .offset(offset);

      const countResult = await db
        .select({ count: count() })
        .from(assemblyBills)
        .where(
          and(
            notInArray(assemblyBills.result, ["가결", "부결", "폐기", "철회", "통과", "공포", "시행"]),
          )
        );

      res.json({ bills: rows, total: countResult[0]?.count ?? 0, page, limit });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 시민 법안 찬반 의견 투표 (POST /api/bills/:id/opinion)
  app.post("/api/bills/:id/opinion", async (req, res) => {
    try {
      const { id: billId } = req.params;
      const { opinion } = req.body;
      if (!opinion || !['agree', 'disagree'].includes(opinion)) {
        return res.status(400).json({ error: "올바른 의견을 입력해주세요 (agree/disagree)" });
      }

      const sessionId = req.sessionID || (req.ip ?? "anon");
      const userId = (req.session as any)?.userId ?? null;

      // 이미 투표했는지 확인
      let existing;
      if (userId) {
        existing = await db.select().from(billOpinionVotes)
          .where(and(eq(billOpinionVotes.billId, billId), eq(billOpinionVotes.userId, userId)))
          .limit(1);
      } else {
        existing = await db.select().from(billOpinionVotes)
          .where(and(eq(billOpinionVotes.billId, billId), eq(billOpinionVotes.sessionId, sessionId)))
          .limit(1);
      }

      if (existing.length > 0) {
        // 같은 의견이면 취소, 다른 의견이면 변경
        if (existing[0].opinion === opinion) {
          await db.delete(billOpinionVotes).where(eq(billOpinionVotes.id, existing[0].id));
          await db.update(assemblyBills)
            .set({ voteCount: dsql`GREATEST(${assemblyBills.voteCount} - 1, 0)` })
            .where(eq(assemblyBills.billId, billId));
        } else {
          await db.update(billOpinionVotes)
            .set({ opinion })
            .where(eq(billOpinionVotes.id, existing[0].id));
        }
      } else {
        await db.insert(billOpinionVotes).values({ billId, userId, sessionId, opinion });
        await db.update(assemblyBills)
          .set({ voteCount: dsql`${assemblyBills.voteCount} + 1` })
          .where(eq(assemblyBills.billId, billId));
      }

      // 최신 집계 반환
      const agreeCount = await db.select({ count: count() }).from(billOpinionVotes)
        .where(and(eq(billOpinionVotes.billId, billId), eq(billOpinionVotes.opinion, 'agree')));
      const disagreeCount = await db.select({ count: count() }).from(billOpinionVotes)
        .where(and(eq(billOpinionVotes.billId, billId), eq(billOpinionVotes.opinion, 'disagree')));

      // 내 현재 투표 상태
      let myOpinion = null;
      if (userId) {
        const mine = await db.select().from(billOpinionVotes)
          .where(and(eq(billOpinionVotes.billId, billId), eq(billOpinionVotes.userId, userId))).limit(1);
        myOpinion = mine[0]?.opinion ?? null;
      } else {
        const mine = await db.select().from(billOpinionVotes)
          .where(and(eq(billOpinionVotes.billId, billId), eq(billOpinionVotes.sessionId, sessionId))).limit(1);
        myOpinion = mine[0]?.opinion ?? null;
      }

      res.json({
        agree: agreeCount[0]?.count ?? 0,
        disagree: disagreeCount[0]?.count ?? 0,
        myOpinion,
      });
    } catch (e: any) {
      console.error("[bill-opinion] error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // 시민 법안 찬반 집계 조회 (GET /api/bills/:id/opinion)
  app.get("/api/bills/:id/opinion", async (req, res) => {
    try {
      const { id: billId } = req.params;
      const sessionId = req.sessionID || (req.ip ?? "anon");
      const userId = (req.session as any)?.userId ?? null;

      const agreeCount = await db.select({ count: count() }).from(billOpinionVotes)
        .where(and(eq(billOpinionVotes.billId, billId), eq(billOpinionVotes.opinion, 'agree')));
      const disagreeCount = await db.select({ count: count() }).from(billOpinionVotes)
        .where(and(eq(billOpinionVotes.billId, billId), eq(billOpinionVotes.opinion, 'disagree')));

      let myOpinion = null;
      if (userId) {
        const mine = await db.select().from(billOpinionVotes)
          .where(and(eq(billOpinionVotes.billId, billId), eq(billOpinionVotes.userId, userId))).limit(1);
        myOpinion = mine[0]?.opinion ?? null;
      } else {
        const mine = await db.select().from(billOpinionVotes)
          .where(and(eq(billOpinionVotes.billId, billId), eq(billOpinionVotes.sessionId, sessionId))).limit(1);
        myOpinion = mine[0]?.opinion ?? null;
      }

      res.json({
        agree: agreeCount[0]?.count ?? 0,
        disagree: disagreeCount[0]?.count ?? 0,
        myOpinion,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 법안 댓글 목록 조회 (GET /api/bills/:id/comments) — 최신순, 작성자 닉네임/이름 포함
  app.get("/api/bills/:id/comments", async (req, res) => {
    try {
      const { id: billId } = req.params;
      const userId = (req.session as any)?.userId ?? null;

      const rows = await db
        .select({
          id: pollComments.id,
          userId: pollComments.userId,
          content: pollComments.content,
          authorType: pollComments.authorType,
          storedDisplayName: pollComments.displayName,
          isVerified: pollComments.isVerified,
          parentId: pollComments.parentId,
          createdAt: pollComments.createdAt,
          userNickname: users.nickname,
          userName: users.name,
        })
        .from(pollComments)
        .leftJoin(users, eq(pollComments.userId, users.id))
        .where(eq(pollComments.pollId, `bill:${billId}`))
        .orderBy(desc(pollComments.createdAt))
        .limit(100);

      res.json(rows.map(c => ({
        id: c.id,
        content: c.content,
        displayName: c.userNickname || c.userName || c.storedDisplayName || "익명의 유권자",
        authorType: c.authorType,
        isVerified: c.isVerified,
        parentId: c.parentId,
        createdAt: c.createdAt,
        isAuthor: userId ? c.userId === userId : false,
      })));
    } catch (e: any) {
      console.error("[bill-comment GET] error:", e.message);
      res.status(500).json({ error: "댓글 조회 중 오류가 발생했습니다" });
    }
  });

  // 법안 댓글 작성 (POST /api/bills/:id/comments) — 익명 허용
  app.post("/api/bills/:id/comments", communityWriteLimiter, async (req, res) => {
    try {
      const { id: billId } = req.params;
      const { content, parentId } = req.body;
      const raw = typeof content === "string" ? content.trim() : "";
      if (raw.length < 1) {
        return res.status(400).json({ error: "댓글 내용을 입력해주세요" });
      }
      if (raw.length > 500) {
        return res.status(400).json({ error: "댓글은 500자 이내로 작성해주세요" });
      }
      const safe = sanitizeText(raw, 500);

      const userId = getActorId(req);
      const user = req.session.userId ? await storage.getUser(req.session.userId) : null;
      const displayName = user?.nickname || user?.name || getOrCreateNickname(userId);
      const parsedParent = typeof parentId === "number" ? parentId : (typeof parentId === "string" && /^\d+$/.test(parentId) ? Number(parentId) : null);

      const [inserted] = await db.insert(pollComments).values({
        pollId: `bill:${billId}`,
        userId,
        content: safe,
        authorType: user?.nickname ? "nickname" : "anonymous",
        displayName,
        isVerified: false,
        parentId: parsedParent,
      }).returning();

      res.json({
        id: inserted.id,
        content: inserted.content,
        displayName: inserted.displayName,
        authorType: inserted.authorType,
        isVerified: inserted.isVerified,
        parentId: inserted.parentId,
        createdAt: inserted.createdAt,
        isAuthor: true,
      });
    } catch (e: any) {
      console.error("[bill-comment] error:", e.message);
      res.status(500).json({ error: "댓글 작성 중 오류가 발생했습니다" });
    }
  });

  // 법안 뉴스 언급 업데이트 (POST /api/bills/update-media-mentions) - 뉴스 RSS에서 법안 키워드 매칭
  // TODO: 이 엔드포인트를 호출하는 백그라운드 Cron 작업(예: 30분마다 RSS 풀링)을 추가해 news_mention_count를 주기적으로 갱신할 것.
  //       현재는 수동/스케줄러에서만 갱신되므로 신규 뉴스 노출이 즉시 Hot Score에 반영되지 않는다.
  app.post("/api/bills/update-media-mentions", syncGuard, async (_req, res) => {
    try {
      // 현재 뉴스 데이터가 캐시에 있으면 활용
      const newsData = newsCache;
      if (!newsData || newsData.items.length === 0) {
        return res.json({ updated: 0, message: "뉴스 캐시가 없습니다. 먼저 /api/news 를 호출하세요." });
      }

      // 심사중인 법안 목록 가져오기
      const bills = await db.select({
        billId: assemblyBills.billId,
        billName: assemblyBills.billName,
      }).from(assemblyBills)
        .where(notInArray(assemblyBills.result, ["가결", "부결", "폐기", "철회", "통과", "공포", "시행"]))
        .limit(500);

      let updated = 0;
      for (const bill of bills) {
        const keywords = bill.billName
          .replace(/[()【】「」\[\]]/g, " ")
          .split(/\s+/)
          .filter(w => w.length >= 3)
          .slice(0, 5);

        const mentionCount = newsData.items.filter(item =>
          keywords.some(kw => item.title.includes(kw))
        ).length;

        if (mentionCount > 0) {
          await db.update(assemblyBills)
            .set({ mediaMentionCount: mentionCount, newsMentionCount: mentionCount })
            .where(eq(assemblyBills.billId, bill.billId));
          updated++;
        }
      }

      res.json({ updated, message: `${updated}개 법안의 미디어 언급 수 업데이트 완료` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 4. 기존 법안 API 호환 (GET /api/db/bills, GET /api/bills)
  const getBillsHandler = async (req: Request, res: Response) => {
    try {
      const includeDiscarded = req.query.includeDiscarded === "true";
      // 비인증 엔드포인트 — 무제한 풀스캔 응답을 막아 자원 고갈(DoS) 방지
      const MAX_ROWS = 2000;
      let rows;
      if (includeDiscarded) {
        rows = await db.select()
          .from(assemblyBills)
          .orderBy(desc(assemblyBills.proposeDate))
          .limit(MAX_ROWS);
      } else {
        rows = await db.select()
          .from(assemblyBills)
          .where(notInArray(assemblyBills.result, ["폐기", "부결", "철회"]))
          .orderBy(desc(assemblyBills.proposeDate))
          .limit(MAX_ROWS);
      }
      res.json(rows);
    } catch (error: any) {
      console.error("[bills] query error:", error);
      res.status(500).json({ error: "법안 조회 중 오류가 발생했습니다" });
    }
  };
  app.get("/api/db/bills", getBillsHandler);
  app.get("/api/bills", getBillsHandler);

  // 5. 법안 조회수 카운트
  app.post("/api/bills/:id/view", async (req, res) => {
    try {
      const { id } = req.params;
      const sessionId = req.sessionID || req.ip;
      const cacheKey = `bill_view_${id}_${sessionId}`;

      const lastViewed = viewCountCache.get(cacheKey);
      if (lastViewed && Date.now() - lastViewed < 60 * 60 * 1000) {
        return res.json({ success: true, message: "이미 카운트된 접속" });
      }

      await db.update(assemblyBills)
        .set({ viewCount: dsql`${assemblyBills.viewCount} + 1` })
        .where(eq(assemblyBills.billId, id));

      viewCountCache.set(cacheKey, Date.now());
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
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
      const rows = await db.select().from(assemblyVotes).where(eq(assemblyVotes.billId, req.params.billId)).limit(400);
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
      let billTotalPages = 0;  // 첫 페이지 응답에서만 결정 (API 불일치 방지)

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
        // INFO-200(데이터 없음) 포함한 모든 비정상 코드 → 탈출
        if (result?.CODE && result.CODE !== "INFO-000") break;

        const totalCount = parseInt(head?.[0]?.list_total_count) || 0;
        const rows = serviceData[1]?.row;
        const pageRows = Array.isArray(rows) ? rows : [];

        // 0건 즉시 탈출 (무한 루프 방지)
        if (totalCount === 0 || pageRows.length === 0) break;

        allBills.push(...pageRows);

        // totalPages는 첫 페이지 응답 기준으로만 산출 (이후 API 값 무시)
        if (pIndex === 1) {
          billTotalPages = Math.ceil(totalCount / PAGE_SIZE);
        }

        if (pIndex >= billTotalPages) break;  // 마지막 페이지 도달 → 탈출
        pIndex++;
        await new Promise((r) => setTimeout(r, 500));  // 500ms 딜레이
      }

      // 대표발의만 필터링 (DB 연결 실패 시 fallback)
      let memberName = "";
      try {
        const [member] = await db.select().from(legislators).where(eq(legislators.monaCd, monaCode));
        memberName = member?.name ?? "";
      } catch {
        memberName = "";
      }
      
      const repBills = memberName 
        ? allBills.filter(bill => {
            const proposer = bill.RST_PROPOSER || bill.PROPOSER || "";
            return proposer.startsWith(memberName);
          })
        : allBills;

      proposedBillsCache.set(monaCode, { bills: repBills, cachedAt: Date.now() });
      return res.json({ monaCode, bills: repBills, total: repBills.length, source: "api" });
    } catch (error: any) {
      console.error("[proposed-bills] API 오류:", error.message);
      return res.status(500).json({ error: "발의 법안 조회 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/db/legislators/:id/votes", async (req, res) => {
    try {
      const rows = await db.select().from(assemblyVotes).where(eq(assemblyVotes.legislatorId, req.params.id)).limit(500);
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

  // ===== AI 정책 성향 "이유있는 점수" 분석가 (차원별 1~10 + 결정적 법안 TOP3) =====
  // 실제 표결 기록에 근거한 LLM 분석. 결정론적 stance.ts 를 정량 앵커로 활용.
  const stanceAnalystCache = new LruMap<string, StanceAnalystReport>(300);
  app.get("/api/db/legislators/:id/stance/analysis", async (req, res) => {
    try {
      const id = req.params.id as string;
      const dimRaw = String(req.query.dimension ?? "econ");
      if (!isPolicyDimension(dimRaw)) {
        return res.status(400).json({ error: "잘못된 dimension (econ|welfare|social|env|justice)" });
      }
      const dimension: PolicyDimension = dimRaw;

      const cacheKey = `stance-analyst::${id}::${dimension}`;
      const l1 = stanceAnalystCache.get(cacheKey);
      if (l1) return res.json(l1);

      // L2: DB 영속 캐시
      const l2 = await getAiCache<StanceAnalystReport>(cacheKey);
      if (l2) { stanceAnalystCache.set(cacheKey, l2); return res.json(l2); }

      if (!process.env.GROQ_API_KEY) {
        return res.status(503).json({ error: "AI 서비스 미설정 (GROQ_API_KEY)" });
      }

      const memberRows = await db
        .select({ name: legislators.name, party: legislators.party, committee: legislators.committee })
        .from(legislators)
        .where(eq(legislators.monaCd, id))
        .limit(1);
      if (memberRows.length === 0) return res.status(404).json({ error: "의원을 찾을 수 없습니다" });
      const m = memberRows[0];

      const report = await analyzePolicyStance(id, dimension, {
        name: m.name,
        party: m.party,
        committee: m.committee,
      });

      // 데이터 부족 결과도 캐시하여 반복 요청·LLM 비용을 절감한다.
      stanceAnalystCache.set(cacheKey, report);
      setAiCache(cacheKey, "stance-analyst", report).catch((e: unknown) =>
        console.error("[stance-analyst] DB 캐시 저장 실패:", (e as Error).message),
      );
      res.json(report);
    } catch (error: any) {
      if (error instanceof LLMConfigError) {
        return res.status(503).json({ error: "AI 서비스 미설정 (GROQ_API_KEY)" });
      }
      if (error instanceof LLMParseError) {
        return res.status(500).json({ error: "분석 결과 파싱 실패" });
      }
      if (error instanceof LLMTransientError) {
        return res.status(503).json({ error: "AI 분석 일시 오류. 잠시 후 다시 시도해주세요." });
      }
      console.error("[stance/analysis] error:", error);
      res.status(500).json({ error: error.message ?? "분석 실패" });
    }
  });

  // ===== 의원 성향 심층 분석 =====
  app.get("/api/members/:id/analysis", async (req, res) => {
    try {
      const result = await analyzeLegislator(req.params.id as string);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== 의원 종합 정보 (기본정보 + 표결/발의 카운트 + 최근 표결 샘플) =====
  // AI 분석에 필요한 데이터가 DB에 충분히 있는지 한눈에 확인하기 위한 통합 엔드포인트.
  // 클라이언트는 이 라우트 하나로 카운트/스냅샷을 가져오고, 본격 분석은
  // /api/members/analyze-profile, /api/legislators/:id/proposed-bills 로 호출한다.
  app.get("/api/members/:id/full", async (req, res) => {
    try {
      const monaCd = req.params.id;

      const [member] = await db
        .select()
        .from(legislators)
        .where(eq(legislators.monaCd, monaCd))
        .limit(1);
      if (!member) return res.status(404).json({ error: "의원을 찾을 수 없습니다" });

      // 표결 카운트·최근 표결·발의 법안·발의 카운트는 서로 독립 →
      // 직렬 4-round-trip 대신 Promise.all 단일 round-trip으로.
      const [[voteAgg], recentVotes, proposedRows, [{ c: proposedCount }]] =
        await Promise.all([
          db
            .select({ c: dsql<number>`count(*)::int` })
            .from(assemblyVotes)
            .where(eq(assemblyVotes.legislatorId, monaCd)),
          db
            .select({
              billId: assemblyVotes.billId,
              billName: assemblyBills.billName,
              committee: assemblyBills.committee,
              voteResult: assemblyVotes.voteResult,
              proposeDate: assemblyBills.proposeDate,
            })
            .from(assemblyVotes)
            .leftJoin(assemblyBills, eq(assemblyVotes.billId, assemblyBills.billId))
            .where(eq(assemblyVotes.legislatorId, monaCd))
            .orderBy(desc(assemblyBills.proposeDate))
            .limit(20),
          // 발의 법안: assembly_bills.proposer 가 의원 이름으로 시작하는 건
          // (bills_proposer_prefix_idx — text_pattern_ops 인덱스 사용)
          db
            .select({
              billId: assemblyBills.billId,
              billName: assemblyBills.billName,
              proposeDate: assemblyBills.proposeDate,
              result: assemblyBills.result,
              committee: assemblyBills.committee,
            })
            .from(assemblyBills)
            .where(dsql`${assemblyBills.proposer} LIKE ${member.name + "%"}`)
            .orderBy(desc(assemblyBills.proposeDate))
            .limit(20),
          db
            .select({ c: dsql<number>`count(*)::int` })
            .from(assemblyBills)
            .where(dsql`${assemblyBills.proposer} LIKE ${member.name + "%"}`),
        ]);

      // in-memory 표결 인덱스 (DB가 비어있어도 분석 가능한 폴백)
      const indexedVotes = legislatorVotesIndex.get(monaCd) ?? [];

      res.json({
        member: {
          monaCd: member.monaCd,
          name: member.name,
          party: member.party,
          district: member.district,
          committee: member.committee,
          photoUrl: member.photoUrl,
          email: member.email,
          birthDate: member.birthDate,
        },
        counts: {
          dbVotes: voteAgg?.c ?? 0,
          memoryVotes: indexedVotes.length,
          proposedBills: proposedCount ?? 0,
        },
        recentVotes,
        proposedBills: proposedRows,
        aiReady: (voteAgg?.c ?? 0) + indexedVotes.length >= 3,
      });
    } catch (error: any) {
      console.error("[members/:id/full] error:", error);
      res.status(500).json({ error: error.message ?? "조회 실패" });
    }
  });

  // actorId: 현재 요청자 식별자(로그인 userId 또는 anon:<uuid>). 본인 글이면 isMine=true.
  // userId 는 응답에서 제거하되, 작성자 본인에게만 수정/삭제 UI를 노출하기 위한 플래그를 추가한다.
  function sanitizePost(post: any, actorId?: string | null) {
    const { userId, ...safe } = post;
    return {
      ...safe,
      // 새 authorType 시스템 우선, 기존 showRealName 폴백
      displayName: post.displayName || (post.showRealName && post.authorName ? post.authorName : "익명의 유권자"),
      authorType: post.authorType || "anonymous",
      isVerified: post.isVerified || false,
      nickname: post.anonNickname,
      authorBadges: post.authorBadges ?? [],
      isMine: !!actorId && userId === actorId,
    };
  }

  function sanitizeComment(comment: any, postUserId: string, actorId?: string | null) {
    const { userId, ...safe } = comment;
    return {
      ...safe,
      displayName: comment.displayName || "익명의 유권자",
      authorType: comment.authorType || "anonymous",
      isVerified: comment.isVerified || false,
      isAuthor: comment.userId === postUserId,
      authorBadges: comment.authorBadges ?? [],
      isMine: !!actorId && comment.userId === actorId,
    };
  }
  // ===== 인메모리 데일리 투표 시스템 =====
  interface PollOption { id: number; label: string; }
  interface DailyPoll {
    id: string;
    board: string;
    question: string;
    options: PollOption[];
    votes: Record<number, number>;
    date: string;
  }

  const dailyPollsStore = new Map<string, DailyPoll>();
  const pollVotersStore = new Map<string, Set<string>>(); // pollId -> Set of userId/IP

  const POLL_BANK: Record<string, { question: string; options: { id: number; label: string }[] }[]> = {
    legislators: [
      { question: "국회의원 특권 폐지 법안에 찬성하십니까?", options: [{id:1,label:"찬성"},{id:2,label:"반대"}] },
      { question: "국회의원 3선 제한 제도 도입에 찬성하십니까?", options: [{id:1,label:"찬성"},{id:2,label:"반대"}] },
      { question: "국회의원 청렴도 공개 의무화에 찬성하십니까?", options: [{id:1,label:"찬성"},{id:2,label:"반대"}] },
      { question: "국회의원 의정활동 실적 공개 제도 확대에 찬성하십니까?", options: [{id:1,label:"찬성"},{id:2,label:"반대"}] },
    ],
    bills: [
      { question: "기본소득 법안 도입에 찬성하십니까?", options: [{id:1,label:"찬성"},{id:2,label:"반대"}] },
      { question: "의대 정원 확대 법안에 찬성하십니까?", options: [{id:1,label:"찬성"},{id:2,label:"반대"}] },
      { question: "주 4일제 근무 법안 도입에 찬성하십니까?", options: [{id:1,label:"찬성"},{id:2,label:"반대"}] },
      { question: "부동산 양도세 강화 법안에 찬성하십니까?", options: [{id:1,label:"찬성"},{id:2,label:"반대"}] },
      { question: "플랫폼 노동자 보호법 도입에 찬성하십니까?", options: [{id:1,label:"찬성"},{id:2,label:"반대"}] },
    ],
    free: [
      { question: "정부의 현 경제 정책 방향에 찬성하십니까?", options: [{id:1,label:"찬성"},{id:2,label:"반대"}] },
      { question: "청년 주거 지원 확대 정책에 찬성하십니까?", options: [{id:1,label:"찬성"},{id:2,label:"반대"}] },
      { question: "대중교통 요금 인상안에 찬성하십니까?", options: [{id:1,label:"찬성"},{id:2,label:"반대"}] },
      { question: "정치인의 SNS 활동 확대에 찬성하십니까?", options: [{id:1,label:"찬성"},{id:2,label:"반대"}] },
    ],
    candidate: [
      { question: "후보자의 전과 기록 공개 강화에 찬성하십니까?", options: [{id:1,label:"찬성"},{id:2,label:"반대"}] },
      { question: "지방의원 유급 보좌관제 도입에 찬성하십니까?", options: [{id:1,label:"찬성"},{id:2,label:"반대"}] },
      { question: "정당 공천제 폐지에 찬성하십니까?", options: [{id:1,label:"찬성"},{id:2,label:"반대"}] },
      { question: "청년 후보 공천 할당제 도입에 찬성하십니까?", options: [{id:1,label:"찬성"},{id:2,label:"반대"}] },
    ],
  };

  function getTodayPoll(board: string): DailyPoll {
    const today = new Date().toISOString().slice(0, 10);
    const key = `${board}:${today}`;
    if (dailyPollsStore.has(key)) return dailyPollsStore.get(key)!;

    const bank = POLL_BANK[board] ?? POLL_BANK.free;
    const dayNum = Math.floor(Date.now() / 86400000);
    const template = bank[dayNum % bank.length];
    const poll: DailyPoll = {
      id: key,
      board,
      question: template.question,
      options: template.options,
      votes: Object.fromEntries(template.options.map(o => [o.id, Math.floor(Math.random() * 120 + 20)])),
      date: today,
    };
    dailyPollsStore.set(key, poll);
    return poll;
  }

  app.get("/api/polls/today", async (req, res) => {
    const board = (req.query.board as string) || "free";
    const poll = getTodayPoll(board);
    const voterKey = poll.id;
    const voterId = req.session.userId || req.ip || "anon";
    const hasVoted = pollVotersStore.get(voterKey)?.has(voterId) ?? false;

    // Fetch top comment
    try {
      const allComments = await db.select().from(pollComments)
        .where(eq(pollComments.pollId, poll.id));
      
      if (allComments.length > 0) {
        const commentIds = allComments.map(c => String(c.id));
        const likesData = await db.select({ targetId: reactions.targetId, count: dsql<number>`count(*)::int` })
          .from(reactions)
          .where(and(
            eq(reactions.targetType, 'comment'),
            eq(reactions.type, 'like'),
            inArray(reactions.targetId, commentIds)
          ))
          .groupBy(reactions.targetId);
        
        const likesMap = new Map(likesData.map(ld => [ld.targetId, ld.count]));
        
        allComments.sort((a, b) => (likesMap.get(String(b.id)) || 0) - (likesMap.get(String(a.id)) || 0));
        
        const topComment = allComments[0];
        const topCommentLikes = likesMap.get(String(topComment.id)) || 0;
        
        return res.json({ 
          ...poll, 
          hasVoted, 
          topComment: {
            ...topComment,
            likes: topCommentLikes
          }
        });
      }
    } catch (error) {
      console.error("Error fetching top comment for poll:", error);
    }

    res.json({ ...poll, hasVoted });
  });

  app.post("/api/polls/:pollId/vote", (req, res) => {
    const { pollId } = req.params;
    const { optionId } = req.body as { optionId: number };
    const poll = dailyPollsStore.get(pollId);
    if (!poll) return res.status(404).json({ error: "투표를 찾을 수 없습니다" });
    const voterId = req.session.userId || req.ip || "anon";
    if (!pollVotersStore.has(pollId)) pollVotersStore.set(pollId, new Set());
    const voters = pollVotersStore.get(pollId)!;
    if (voters.has(voterId)) return res.status(409).json({ error: "이미 투표하셨습니다" });
    voters.add(voterId);
    poll.votes[optionId] = (poll.votes[optionId] ?? 0) + 1;
    res.json({ ...poll, hasVoted: true });
  });

  // ===== 통합 반응 API =====
  const REACTION_TYPES = ["like", "dislike", "funny", "sad", "angry"] as const;

  app.post("/api/reactions", async (req, res) => {
    try {
      const { targetType, targetId, type, sessionId } = req.body;
      if (!targetType || targetId == null || !type) {
        return res.status(400).json({ error: "targetType, targetId, type 필수" });
      }
      if (!REACTION_TYPES.includes(type)) {
        return res.status(400).json({ error: `type은 ${REACTION_TYPES.join(",")} 중 하나여야 합니다` });
      }
      const userId = req.session.userId ? parseInt(req.session.userId, 10) || null : null;
      const sId = userId ? null : (sessionId || req.sessionID || null);

      if (!userId && !sId) {
        return res.status(400).json({ error: "투표자 식별 불가 (sessionId 필요)" });
      }

      // 토글: 기존 반응 조회
      let existing;
      if (userId) {
        [existing] = await db.select().from(reactions)
          .where(and(
            eq(reactions.targetType, targetType),
            eq(reactions.targetId, targetId),
            eq(reactions.userId, userId)
          ))
          .limit(1);
      } else {
        [existing] = await db.select().from(reactions)
          .where(and(
            eq(reactions.targetType, targetType),
            eq(reactions.targetId, targetId),
            eq(reactions.sessionId, sId!)
          ))
          .limit(1);
      }

      if (existing) {
        // 같은 타입이면 취소, 다르면 변경
        if (existing.type === type) {
          await db.delete(reactions).where(eq(reactions.id, existing.id));
        } else {
          await db.update(reactions).set({ type }).where(eq(reactions.id, existing.id));
        }
      } else {
        // 새 반응 삽입
        await db.insert(reactions).values({
          targetType,
          targetId: targetId,
          userId,
          sessionId: sId,
          type,
        });
      }

      // 집계 + 내 반응 반환
      const allReactions = await db.select().from(reactions)
        .where(and(
          eq(reactions.targetType, targetType),
          eq(reactions.targetId, targetId)
        ));
      const counts: Record<string, number> = { like: 0, dislike: 0, funny: 0, sad: 0, angry: 0 };
      for (const r of allReactions) counts[r.type] = (counts[r.type] || 0) + 1;

      let myReaction: string | null = null;
      if (userId) {
        const mine = allReactions.find(r => r.userId === userId);
        myReaction = mine?.type ?? null;
      } else {
        const mine = allReactions.find(r => r.sessionId === sId);
        myReaction = mine?.type ?? null;
      }

      res.json({ counts, myReaction });
    } catch (error: any) {
      console.error("Reaction error:", error);
      res.status(500).json({ error: "반응 처리 중 오류" });
    }
  });

  app.get("/api/reactions", async (req, res) => {
    try {
      const { targetType, targetId, sessionId } = req.query as Record<string, string>;
      if (!targetType || !targetId) {
        return res.status(400).json({ error: "targetType, targetId 필수" });
      }

      const allReactions = await db.select().from(reactions)
        .where(and(
          eq(reactions.targetType, targetType),
          eq(reactions.targetId, targetId)
        ));

      const counts: Record<string, number> = { like: 0, dislike: 0, funny: 0, sad: 0, angry: 0 };
      for (const r of allReactions) counts[r.type] = (counts[r.type] || 0) + 1;

      const userId = req.session.userId ? parseInt(req.session.userId, 10) || null : null;
      const sId = userId ? null : (sessionId || null);
      let myReaction: string | null = null;

      if (userId) {
        const mine = allReactions.find(r => r.userId === userId);
        myReaction = mine?.type ?? null;
      } else if (sId) {
        const mine = allReactions.find(r => r.sessionId === sId);
        myReaction = mine?.type ?? null;
      }

      res.json({ counts, myReaction });
    } catch (error: any) {
      console.error("Get reactions error:", error);
      res.status(500).json({ error: "반응 조회 중 오류" });
    }
  });

  // ===== 투표 댓글 API ===== (비로그인 허용)
  app.post("/api/poll-comments", communityWriteLimiter, async (req, res) => {
    try {
      const { pollId, content, parentId } = req.body;
      const raw = typeof content === "string" ? content.trim() : "";
      if (!pollId || raw.length === 0) {
        return res.status(400).json({ error: "pollId와 content 필수" });
      }
      if (raw.length > 500) {
        return res.status(400).json({ error: "댓글은 500자 이내로 작성해주세요" });
      }
      const safe = sanitizeText(raw, 500);

      const actorId = getActorId(req);
      let resolvedAuthorType = "anonymous";
      let resolvedDisplayName: string | null = getOrCreateNickname(actorId);
      let resolvedIsVerified = false;

      if (req.session.userId) {
        const user = await storage.getUser(req.session.userId);
        if (user) {
          if (user.nickname) {
            resolvedAuthorType = "nickname";
            resolvedDisplayName = user.nickname;
          } else {
            resolvedAuthorType = "anonymous";
            resolvedDisplayName = user.name || "익명";
          }
        }
      }

      const parsedParent = typeof parentId === "number" ? parentId : (typeof parentId === "string" && /^\d+$/.test(parentId) ? Number(parentId) : null);

      const [comment] = await db.insert(pollComments).values({
        pollId,
        userId: actorId,
        content: safe,
        authorType: resolvedAuthorType,
        displayName: resolvedDisplayName,
        isVerified: resolvedIsVerified,
        parentId: parsedParent,
      }).returning();

      res.json(comment);
    } catch (error: any) {
      console.error("Poll comment error:", error);
      res.status(500).json({ error: "투표 댓글 작성 중 오류" });
    }
  });

  app.get("/api/poll-comments", async (req, res) => {
    try {
      const { pollId } = req.query as Record<string, string>;
      if (!pollId) return res.status(400).json({ error: "pollId 필수" });

      const rows = await db.select().from(pollComments)
        .where(eq(pollComments.pollId, pollId))
        .orderBy(pollComments.createdAt);

      if (rows.length === 0) return res.json([]);

      // Fetch likes for comments
      const commentIds = rows.map(r => String(r.id));
      const likesData = await db.select({ targetId: reactions.targetId, count: dsql<number>`count(*)::int` })
        .from(reactions)
        .where(and(
          eq(reactions.targetType, 'comment'),
          eq(reactions.type, 'like'),
          inArray(reactions.targetId, commentIds)
        ))
        .groupBy(reactions.targetId);

      const likesMap = new Map(likesData.map(ld => [ld.targetId, ld.count]));

      const commentsWithLikes = rows.map(r => ({
        ...r,
        likes: likesMap.get(String(r.id)) || 0,
      }));

      // 내 반응 정보 (로그인 시) — reactions.userId는 integer라 UUID이면 매칭 불가, 안전하게 스킵
      const rawUserId = req.session.userId;
      const numericUserId = rawUserId && /^\d+$/.test(rawUserId) ? Number(rawUserId) : null;
      let myReactionsMap = new Map<string, string>();
      if (numericUserId !== null) {
        const myReactions = await db.select().from(reactions)
          .where(and(
            eq(reactions.targetType, 'comment'),
            eq(reactions.userId, numericUserId),
            inArray(reactions.targetId, commentIds)
          ));
        myReactions.forEach(r => myReactionsMap.set(r.targetId, r.type));
      }

      const finalComments = commentsWithLikes.map(c => ({
        ...c,
        myReaction: myReactionsMap.get(String(c.id)) || null,
      }));

      // 중첩 구조 만들기
      const topLevel = finalComments.filter(r => !r.parentId);
      const nested = topLevel.map(parent => ({
        ...parent,
        replies: finalComments.filter(r => r.parentId === parent.id),
      }));

      res.json(nested);
    } catch (error: any) {
      console.error("Get poll comments error:", error);
      res.status(500).json({ error: "투표 댓글 조회 중 오류" });
    }
  });

  // ===== 파일 업로드 API =====
  // 운영에서는 Supabase Storage(영속)에, 미설정 시 로컬 디스크(휘발성, 개발용)에 저장.
  // 파일은 메모리로 받은 뒤 storage-upload 헬퍼가 목적지를 결정한다.
  const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  const ALLOWED_IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

  if (isProduction && !isSupabaseStorageConfigured()) {
    console.warn(
      "[upload] Supabase Storage 미설정 — 업로드가 휘발성 로컬 디스크에 저장됩니다. " +
        "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 설정하세요.",
    );
  }

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ALLOWED_IMAGE_MIME.has(file.mimetype) && ALLOWED_IMAGE_EXT.has(ext)) {
        return cb(null, true);
      }
      cb(new Error("이미지(jpg/png/webp/gif)만 업로드할 수 있습니다."));
    },
  });

  // 로그인 사용자만 업로드 허용 (익명 업로드로 인한 스토리지 남용·유해물 업로드 차단)
  app.post(
    "/api/upload",
    requireAuth,
    (req, res, next) => {
      upload.single("file")(req, res, (err: any) => {
        if (err) {
          return res.status(400).json({ error: err.message || "업로드 실패" });
        }
        next();
      });
    },
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: "파일이 업로드되지 않았습니다." });
      }
      try {
        // 파일명/확장자는 mimetype에서 유도 (originalname의 공격자 조작 차단)
        const filename = randomBytes(16).toString("hex") + extForMime(req.file.mimetype);
        const url = await saveUploadedImage(filename, req.file.buffer, req.file.mimetype);
        res.json({ url });
      } catch (e: any) {
        console.error("Upload error:", e?.message || e);
        res.status(500).json({ error: "이미지 저장 중 오류가 발생했습니다." });
      }
    }
  );

  // ===== 커뮤니티 게시글 =====

  // 가장 활발한 토론 — 댓글 수 기준 가장 많이 달린 단일 게시글
  // ?tagType=bill 로 법안 태그 게시글로 좁힐 수 있다.
  app.get("/api/community/hot-discussion", async (req, res) => {
    try {
      const { tagType } = req.query as Record<string, string>;
      const conditions = [
        notInArray(communityPosts.boardType, ["members"]),
      ];
      if (tagType) conditions.push(eq(communityPosts.tagType, tagType));

      const commentAgg = db.$with("comment_agg").as(
        db
          .select({
            postId: communityComments.postId,
            commentCount: dsql<number>`count(*)::int`.as("comment_count"),
          })
          .from(communityComments)
          .groupBy(communityComments.postId)
      );

      const rows = await db
        .with(commentAgg)
        .select({
          id: communityPosts.id,
          title: communityPosts.title,
          tagType: communityPosts.tagType,
          tagId: communityPosts.tagId,
          tagName: communityPosts.tagName,
          boardType: communityPosts.boardType,
          createdAt: communityPosts.createdAt,
          commentCount: dsql<number>`COALESCE(${commentAgg.commentCount}, 0)`,
        })
        .from(communityPosts)
        .leftJoin(commentAgg, eq(commentAgg.postId, communityPosts.id))
        .where(and(...conditions))
        .orderBy(desc(dsql`COALESCE(${commentAgg.commentCount}, 0)`), desc(communityPosts.createdAt))
        .limit(1);

      res.json(rows[0] ?? null);
    } catch (e: any) {
      console.error("[hot-discussion] error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // 오늘 가장 좋아요가 많은 게시물 최대 5건 (홈 "가장 인기있는 토론" 위젯). 오늘 글이 없으면 전체 기간 최다 추천글로 폴백.
  app.get("/api/community/top-liked", async (_req, res) => {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const baseConditions = [
        notInArray(communityPosts.boardType, ["members"]),
        isNull(communityPosts.hiddenAt),
      ];

      const selectCols = {
        id: communityPosts.id,
        title: communityPosts.title,
        likes: communityPosts.likes,
        boardType: communityPosts.boardType,
        createdAt: communityPosts.createdAt,
      };

      let rows = await db
        .select(selectCols)
        .from(communityPosts)
        .where(and(...baseConditions, gte(communityPosts.createdAt, startOfToday)))
        .orderBy(desc(communityPosts.likes), desc(communityPosts.createdAt))
        .limit(5);

      if (rows.length === 0) {
        rows = await db
          .select(selectCols)
          .from(communityPosts)
          .where(and(...baseConditions))
          .orderBy(desc(communityPosts.likes), desc(communityPosts.createdAt))
          .limit(5);
      }

      res.json(rows);
    } catch (e: any) {
      console.error("[top-liked] error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/community/posts", async (req, res) => {

    try {
      const { board, category, sort, theme, legislatorId, tagType, tagId } = req.query as Record<string, string>;
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
      const listActorId = peekActorId(req);
      const posts = await storage.getPosts({
        boardType: theme || board || undefined,
        category: category || undefined,
        sort: sort || "latest",
        legislatorId: legislatorId || undefined,
        tagType: tagType || undefined,
        tagId: tagId || undefined,
        viewerId: listActorId || undefined,
      });
      res.json(posts.map((p) => sanitizePost(p, listActorId)));
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
      let comments = await storage.getComments(post.id);
      let userReactions: { sentiment: string | null; stance: string | null } = { sentiment: null, stance: null };
      let isBookmarked = false;
      const activeUserId = peekActorId(req);
      if (activeUserId) {
        userReactions = await storage.getUserReactions(post.id, activeUserId);
        // 차단한 작성자의 댓글 숨김
        const blocked = await storage.getBlockedIds(activeUserId);
        if (blocked.length > 0) comments = comments.filter((c) => !blocked.includes(c.userId));
      }
      if (req.session.userId) {
        const bookmarks = await storage.getUserBookmarks(req.session.userId);
        isBookmarked = bookmarks.includes(post.id);
      }
      res.json({
        post: sanitizePost(post, activeUserId),
        comments: comments.map((c) => sanitizeComment(c, post.userId, activeUserId)),
        userReactions,
        isBookmarked,
      });
    } catch (error) {
      console.error("Get post error:", error);
      res.status(500).json({ error: "게시글 조회 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/community/posts", communityWriteLimiter, async (req, res) => {
    try {
      const result = insertPostSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "제목과 내용을 입력하세요" });
      }

      const { boardType, tagId, legislatorId } = req.body;

      // 국회의원 게시판 또는 법안 게시판일 경우 태그 필수 검증
      if (boardType === "legislators" && !tagId && !legislatorId) {
        return res.status(400).json({ error: "국회의원을 태그해야 합니다." });
      }
      if (boardType === "bills" && !tagId) {
        return res.status(400).json({ error: "법안을 태그해야 합니다." });
      }
      if (boardType === "candidate" && !tagId) {
        return res.status(400).json({ error: "후보자를 태그해야 합니다." });
      }

      const requestedAuthorType = result.data.authorType ?? "anonymous";
      let userId = req.session.userId || null;
      let authorType = "anonymous";
      let displayName: string | null = "익명";
      let isVerified = false;
      const nickname = getOrCreateNickname(getActorId(req));

      if (userId) {
        const user = await storage.getUser(userId);
        if (user) {
          if (requestedAuthorType === "realname") {
            if (!user.realNameVerified || !user.realName) {
              return res.status(403).json({ error: "실명인증이 필요합니다" });
            }
            authorType = "realname";
            displayName = user.realName;
            isVerified = true;
          } else if (requestedAuthorType === "nickname") {
            if (!user.nickname) {
              return res.status(400).json({ error: "닉네임을 먼저 설정해주세요" });
            }
            authorType = "nickname";
            displayName = user.nickname;
            isVerified = false;
          } else {
            authorType = "anonymous";
            displayName = "익명";
            isVerified = false;
          }
        }
      } else {
        // 비로그인 게시 — 안정적 anon:<uuid> 로 저장(자기 글 작성자 판별 가능)
        userId = getActorId(req);
        authorType = "anonymous";
        displayName = "익명";
      }

      const { thumbnailUrl, tagType, tagName } = req.body;

      // XSS 1차 방어 — 저장 시점에 HTML 정화. 클라이언트 DOMPurify가 2차 방어선.
      const safeTitle = sanitizeText(result.data.title, 200);
      const safeContent = sanitizeHtml(result.data.content);
      if (!safeTitle || !safeContent) {
        return res.status(400).json({ error: "제목/내용을 다시 확인해주세요" });
      }

      const post = await storage.createPost(
        userId,
        safeTitle,
        safeContent,
        nickname,
        result.data.boardType ?? "open",
        result.data.category ?? "자유",
        result.data.showRealName ?? false,
        result.data.legislatorId,
        authorType,
        displayName,
        isVerified,
        thumbnailUrl || null,
        tagType || null,
        tagId || null,
        tagName || null,
        result.data.attachments || [],
        "rich",
        result.data.hasPoll ?? false,
      );
      const authorBadges = !isAnonId(userId) ? await storage.getUserBadges(userId) : [];
      res.json(sanitizePost({ ...post, authorBadges, authorName: "" }, userId));
    } catch (error) {
      console.error("Create post error:", error);
      res.status(500).json({ error: "게시글 작성 중 오류가 발생했습니다" });
    }
  });

  // 게시글 수정 — 작성자 본인만. 제목/내용/카테고리만 변경 가능(게시판/태그는 고정).
  app.patch("/api/community/posts/:id", communityWriteLimiter, async (req, res) => {
    try {
      const post = await storage.getPost(req.params.id as string);
      if (!post) return res.status(404).json({ error: "게시글을 찾을 수 없습니다" });
      const actorId = getActorId(req);
      if (post.userId !== actorId) {
        return res.status(403).json({ error: "본인이 작성한 글만 수정할 수 있습니다" });
      }
      const { title, content, category } = req.body as { title?: string; content?: string; category?: string };
      const fields: { title?: string; content?: string; category?: string } = {};
      if (title !== undefined) {
        const safeTitle = sanitizeText(title, 200);
        if (!safeTitle) return res.status(400).json({ error: "제목을 다시 확인해주세요" });
        fields.title = safeTitle;
      }
      if (content !== undefined) {
        const safeContent = sanitizeHtml(content);
        if (!safeContent) return res.status(400).json({ error: "내용을 다시 확인해주세요" });
        fields.content = safeContent;
      }
      if (category !== undefined && ["자유", "토론", "정보공유", "질문"].includes(category)) {
        fields.category = category;
      }
      const updated = await storage.updatePost(post.id, fields);
      if (!updated) return res.status(404).json({ error: "게시글을 찾을 수 없습니다" });
      const authorBadges = !isAnonId(actorId) ? await storage.getUserBadges(actorId) : [];
      res.json(sanitizePost({ ...updated, authorBadges, authorName: "" }, actorId));
    } catch (error) {
      console.error("Update post error:", error);
      res.status(500).json({ error: "게시글 수정 중 오류가 발생했습니다" });
    }
  });

  // 게시글 삭제 — 작성자 본인만(soft delete). 목록/상세에서 즉시 숨김 처리된다.
  app.delete("/api/community/posts/:id", async (req, res) => {
    try {
      const post = await storage.getPost(req.params.id as string);
      if (!post) return res.status(404).json({ error: "게시글을 찾을 수 없습니다" });
      const actorId = getActorId(req);
      if (post.userId !== actorId) {
        return res.status(403).json({ error: "본인이 작성한 글만 삭제할 수 있습니다" });
      }
      await storage.softDeletePost(post.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete post error:", error);
      res.status(500).json({ error: "게시글 삭제 중 오류가 발생했습니다" });
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
      const posts = await storage.getPosts();
      const bookmarked = posts.filter((p) => postIds.includes(p.id));
      res.json(bookmarked.map((p) => sanitizePost(p, req.session.userId)));
    } catch (error) {
      res.status(500).json({ error: "북마크 조회 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/community/posts/:id/comments", communityWriteLimiter, async (req, res) => {
    try {
      const result = insertCommentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "댓글 내용을 입력하세요" });
      }
      const post = await storage.getPost(req.params.id as string);
      if (!post) return res.status(404).json({ error: "게시글을 찾을 수 없습니다" });

      const requestedAuthorType = (req.body.authorType as string) || "anonymous";
      const userId = getActorId(req);
      const anonNickname = getOrCreateNickname(userId);
      let authorType = "anonymous";
      let displayName: string | null = "익명";
      let isVerified = false;

      if (req.session.userId) {
        const user = await storage.getUser(req.session.userId);
        if (user) {
          if (requestedAuthorType === "realname") {
            if (user.realNameVerified && user.realName) {
              authorType = "realname";
              displayName = user.realName;
              isVerified = true;
            }
          } else if (requestedAuthorType === "nickname") {
            if (user.nickname) {
              authorType = "nickname";
              displayName = user.nickname;
            }
          }
        }
      }

      // 댓글은 일반 평문 — 태그/스크립트 제거
      const safeContent = sanitizeText(result.data.content, 2000);
      if (!safeContent) {
        return res.status(400).json({ error: "댓글 내용을 입력하세요" });
      }
      const parentId = typeof req.body.parentId === "string" && req.body.parentId ? req.body.parentId : null;
      const comment = await storage.createComment(post.id, userId, safeContent, anonNickname, authorType, displayName, isVerified, parentId);
      res.json(sanitizeComment(comment, post.userId, userId));
    } catch (error) {
      console.error("Create comment error:", error);
      res.status(500).json({ error: "댓글 작성 중 오류가 발생했습니다" });
    }
  });

  // 댓글 수정 — 작성자 본인만. 평문만 허용.
  app.patch("/api/community/comments/:id", communityWriteLimiter, async (req, res) => {
    try {
      const comment = await storage.getComment(req.params.id as string);
      if (!comment) return res.status(404).json({ error: "댓글을 찾을 수 없습니다" });
      const actorId = getActorId(req);
      if (comment.userId !== actorId) {
        return res.status(403).json({ error: "본인이 작성한 댓글만 수정할 수 있습니다" });
      }
      const safeContent = sanitizeText((req.body?.content as string) ?? "", 2000);
      if (!safeContent) return res.status(400).json({ error: "댓글 내용을 입력하세요" });
      await storage.updateComment(comment.id, safeContent);
      const post = await storage.getPost(comment.postId);
      res.json(sanitizeComment({ ...comment, content: safeContent }, post?.userId ?? "", actorId));
    } catch (error) {
      console.error("Update comment error:", error);
      res.status(500).json({ error: "댓글 수정 중 오류가 발생했습니다" });
    }
  });

  // 댓글 삭제 — 작성자 본인만(soft delete).
  app.delete("/api/community/comments/:id", async (req, res) => {
    try {
      const comment = await storage.getComment(req.params.id as string);
      if (!comment) return res.status(404).json({ error: "댓글을 찾을 수 없습니다" });
      const actorId = getActorId(req);
      if (comment.userId !== actorId) {
        return res.status(403).json({ error: "본인이 작성한 댓글만 삭제할 수 있습니다" });
      }
      await storage.softDeleteComment(comment.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete comment error:", error);
      res.status(500).json({ error: "댓글 삭제 중 오류가 발생했습니다" });
    }
  });

  // ===== 내 활동 내역 및 투표 법안 조회 =====
  app.get("/api/auth/my-activity", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const posts = await db.select().from(communityPosts)
        .where(eq(communityPosts.userId, userId))
        .orderBy(desc(communityPosts.createdAt));
      const comments = await db.select().from(communityComments)
        .where(eq(communityComments.userId, userId))
        .orderBy(desc(communityComments.createdAt));

      const votedBillsRaw = await db.select({
        vote: billOpinionVotes,
        bill: assemblyBills,
      })
      .from(billOpinionVotes)
      .leftJoin(assemblyBills, eq(billOpinionVotes.billId, assemblyBills.billId))
      .where(eq(billOpinionVotes.userId, userId))
      .orderBy(desc(billOpinionVotes.createdAt));

      const votedBills = votedBillsRaw.map(r => ({
        ...r.vote,
        billName: r.bill?.billName || "알 수 없는 법안",
        committee: r.bill?.committee || "",
        proposer: r.bill?.proposer || "",
        result: r.bill?.result || "",
      }));

      res.json({ posts, comments, votedBills });
    } catch (error) {
      console.error("my-activity error:", error);
      res.status(500).json({ error: "내 활동 내역 조회 중 오류가 발생했습니다." });
    }
  });

  // ===== 의원 팔로우 시스템 (Story 피드 + 개인화 타임라인) =====
  // 팔로우한 의원 목록 조회 — Story UI용. legislators 메타까지 조인해서 한 번에 반환.
  app.get("/api/users/me/follows", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const rows = await db
        .select({
          follow: userFollows,
          legislator: legislators,
        })
        .from(userFollows)
        .leftJoin(legislators, eq(userFollows.politicianId, legislators.monaCd))
        .where(eq(userFollows.userId, userId))
        .orderBy(desc(userFollows.createdAt));

      // 최근 발의일을 조회해 Story Ring(3일내 업데이트) 표시 여부 판단
      const politicianIds = rows.map((r) => r.follow.politicianId);
      const lastActivity = new Map<string, string>(); // monaCd → 가장 최근 활동 ISO 날짜

      if (politicianIds.length > 0) {
        const legislatorRows = rows
          .map((r) => r.legislator)
          .filter((l): l is NonNullable<typeof l> => !!l);
        const proposerNames = legislatorRows.map((l) => l.name);

        // 최근 30일 발의 법안 → 대표발의자 이름 매칭 (가장 가까운 ISO 호환 비교)
        if (proposerNames.length > 0) {
          const recentBills = await db
            .select({
              billId: assemblyBills.billId,
              billName: assemblyBills.billName,
              proposer: assemblyBills.proposer,
              proposeDate: assemblyBills.proposeDate,
            })
            .from(assemblyBills)
            .orderBy(desc(assemblyBills.proposeDate))
            .limit(200);

          for (const bill of recentBills) {
            const primary = (bill.proposer || "").split("(")[0].split(",")[0].trim();
            const matched = legislatorRows.find((l) => l.name === primary);
            if (matched && bill.proposeDate) {
              const prev = lastActivity.get(matched.monaCd);
              if (!prev || bill.proposeDate > prev) {
                lastActivity.set(matched.monaCd, bill.proposeDate);
              }
            }
          }
        }
      }

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const data = rows.map((r) => {
        const lastDate = lastActivity.get(r.follow.politicianId);
        const hasRecentUpdate = lastDate ? new Date(lastDate) >= threeDaysAgo : false;
        return {
          id: r.follow.politicianId,
          name: r.legislator?.name ?? "알 수 없음",
          party: r.legislator?.party ?? "",
          district: r.legislator?.district ?? "",
          photo: r.legislator?.photoUrl ?? "",
          followedAt: r.follow.createdAt,
          lastActivityDate: lastDate ?? null,
          hasRecentUpdate,
        };
      });

      res.json({ follows: data });
    } catch (error) {
      console.error("follows list error:", error);
      res.status(500).json({ error: "팔로우 목록 조회 중 오류가 발생했습니다." });
    }
  });

  // ===== 스토리 피드 =====
  // 팔로우한 정치인 × 최근 48h 뉴스 교차 → 인스타 스토리 형식으로 반환.
  // 오늘 뉴스가 있는 정치인에 hasNews=true, 뉴스 목록도 함께 반환.
  app.get("/api/feed/stories", async (req, res) => {
    try {
      const userId = req.session?.userId ?? null;
      if (!userId) return res.json({ stories: [] });

      const followed = await db
        .select({
          politicianId: userFollows.politicianId,
          name: legislators.name,
          party: legislators.party,
          photo: legislators.photoUrl,
          monaCd: legislators.monaCd,
        })
        .from(userFollows)
        .leftJoin(legislators, eq(userFollows.politicianId, legislators.monaCd))
        .where(eq(userFollows.userId, userId));

      // 뉴스 캐시 확보
      if (!newsCache || Date.now() - newsCache.cachedAt >= NEWS_CACHE_TTL) {
        const result = await fetchKoreanPoliticsNews();
        newsCache = { ...result, cachedAt: Date.now() };
      }
      const now48h = Date.now() - 48 * 60 * 60 * 1000;
      const recentNews = (newsCache?.items ?? []).filter((item) => {
        const t = new Date(item.pubDate).getTime();
        return !isNaN(t) && t >= now48h;
      });

      const allStories = followed.map((f) => {
        const name = f.name ?? "";
        const matched = name
          ? recentNews
              .filter((item) => item.title.includes(name))
              .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
              .slice(0, 5)
          : [];
        return {
          id: f.politicianId,
          name,
          party: f.party ?? "",
          photo: f.photo ?? null,
          hasNews: matched.length > 0,
          newsItems: matched.map((n) => ({
            title: n.title,
            link: n.link,
            pubDate: n.pubDate,
            source: n.source,
            summary: n.summary ?? "",
          })),
        };
      });

      // 48시간 내 공개활동(뉴스)이 있는 의원만 표시, 최신순 정렬
      let stories = allStories
        .filter((s) => s.hasNews)
        .sort((a, b) => {
          const aLatest = a.newsItems[0]?.pubDate ? new Date(a.newsItems[0].pubDate).getTime() : 0;
          const bLatest = b.newsItems[0]?.pubDate ? new Date(b.newsItems[0].pubDate).getTime() : 0;
          return bLatest - aLatest;
        });

      let isRecommended = false;

      if (stories.length === 0) {
        // 관심 의원 중 활동한 의원이 없으므로, 다른 활동 중인 의원을 노출
        const allLegislators = await db
          .select({
            monaCd: legislators.monaCd,
            name: legislators.name,
            party: legislators.party,
            photo: legislators.photoUrl,
          })
          .from(legislators);

        const followedIds = new Set(followed.map((f) => f.politicianId));
        const otherLegislators = allLegislators.filter((l) => !followedIds.has(l.monaCd));

        const otherStories = otherLegislators.map((l) => {
          const name = l.name ?? "";
          const matched = name
            ? recentNews
                .filter((item) => item.title.includes(name))
                .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
                .slice(0, 5)
            : [];
          return {
            id: l.monaCd,
            name,
            party: l.party ?? "",
            photo: l.photo ?? null,
            hasNews: matched.length > 0,
            newsItems: matched.map((n) => ({
              title: n.title,
              link: n.link,
              pubDate: n.pubDate,
              source: n.source,
              summary: n.summary ?? "",
            })),
          };
        });

        const activeOthers = otherStories
          .filter((s) => s.hasNews)
          .sort((a, b) => {
            const aLatest = a.newsItems[0]?.pubDate ? new Date(a.newsItems[0].pubDate).getTime() : 0;
            const bLatest = b.newsItems[0]?.pubDate ? new Date(b.newsItems[0].pubDate).getTime() : 0;
            return bLatest - aLatest;
          });

        stories = activeOthers.slice(0, 15);
        isRecommended = true;
      }

      res.json({ stories, followedCount: followed.length, isRecommended });
    } catch (err: any) {
      console.error("stories feed error:", err);
      res.status(500).json({ error: "스토리 피드 조회 오류" });
    }
  });

  // 팔로우 추가
  app.post("/api/users/me/follows/:politicianId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const politicianId = req.params.politicianId;
      if (!politicianId) return res.status(400).json({ error: "정치인 ID가 필요합니다." });

      const type = (req.body?.type === "candidate" ? "candidate" : "member") as "member" | "candidate";

      await db
        .insert(userFollows)
        .values({ userId, politicianId: politicianId as string, politicianType: type })
        .onConflictDoNothing({ target: [userFollows.userId, userFollows.politicianId] });

      // followerCount 증가 (member 타입만)
      if (type === "member") {
        await db
          .update(legislators)
          .set({ followerCount: dsql`${legislators.followerCount} + 1` })
          .where(eq(legislators.monaCd, politicianId as string));
      }

      clearTimelineCacheForUser(userId);

      res.json({ following: true });
    } catch (error) {
      console.error("follow error:", error);
      res.status(500).json({ error: "팔로우 처리 중 오류가 발생했습니다." });
    }
  });

  // 언팔로우
  app.delete("/api/users/me/follows/:politicianId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const politicianId = req.params.politicianId;

      const pid = politicianId as string;
      const [existing] = await db
        .select()
        .from(userFollows)
        .where(and(eq(userFollows.userId, userId), eq(userFollows.politicianId, pid)))
        .limit(1);

      if (!existing) return res.json({ following: false });

      await db
        .delete(userFollows)
        .where(and(eq(userFollows.userId, userId), eq(userFollows.politicianId, pid)));

      if (existing.politicianType === "member") {
        await db
          .update(legislators)
          .set({ followerCount: dsql`GREATEST(${legislators.followerCount} - 1, 0)` })
          .where(eq(legislators.monaCd, pid));
      }

      clearTimelineCacheForUser(userId);

      res.json({ following: false });
    } catch (error) {
      console.error("unfollow error:", error);
      res.status(500).json({ error: "언팔로우 처리 중 오류가 발생했습니다." });
    }
  });

  // ===== 개인화 실시간 활동 피드 =====
  // 팔로우한 의원의 최근 발의 법안 + 표결 활동을 시간순으로 합쳐서 반환.
  app.get("/api/users/me/feed", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const limit = Math.min(parseInt(String(req.query.limit ?? "30")) || 30, 100);

      const followRows = await db
        .select({
          politicianId: userFollows.politicianId,
          name: legislators.name,
          party: legislators.party,
          photo: legislators.photoUrl,
        })
        .from(userFollows)
        .leftJoin(legislators, eq(userFollows.politicianId, legislators.monaCd))
        .where(eq(userFollows.userId, userId));

      if (followRows.length === 0) {
        return res.json({ items: [], followCount: 0 });
      }

      const monaCds = followRows.map((r) => r.politicianId);
      const nameToMeta = new Map<string, { politicianId: string; name: string; party: string | null; photo: string | null }>();
      for (const r of followRows) {
        if (r.name) {
          nameToMeta.set(r.name, {
            politicianId: r.politicianId,
            name: r.name,
            party: r.party,
            photo: r.photo,
          });
        }
      }

      // 1) 발의 법안 — 이름 매칭
      const recentBills = await db
        .select()
        .from(assemblyBills)
        .orderBy(desc(assemblyBills.proposeDate))
        .limit(500);

      const billItems = recentBills
        .map((bill) => {
          const primary = (bill.proposer || "").split("(")[0].split(",")[0].trim();
          const meta = nameToMeta.get(primary);
          if (!meta) return null;
          return {
            type: "bill" as const,
            id: `bill-${bill.billId}`,
            politicianId: meta.politicianId,
            politicianName: meta.name,
            party: meta.party,
            photo: meta.photo,
            title: bill.billName,
            subtitle: bill.committee || "법안 발의",
            billId: bill.billId,
            occurredAt: bill.proposeDate || "",
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      // 2) 표결 — legislatorId 직접 매칭
      const recentVotes = await db
        .select({
          vote: assemblyVotes,
          bill: assemblyBills,
        })
        .from(assemblyVotes)
        .leftJoin(assemblyBills, eq(assemblyVotes.billId, assemblyBills.billId))
        .where(inArray(assemblyVotes.legislatorId, monaCds))
        .orderBy(desc(assemblyVotes.syncedAt))
        .limit(200);

      const voteItems = recentVotes.map((r) => {
        const meta = followRows.find((f) => f.politicianId === r.vote.legislatorId);
        return {
          type: "vote" as const,
          id: `vote-${r.vote.id}`,
          politicianId: r.vote.legislatorId,
          politicianName: r.vote.legislatorName,
          party: meta?.party ?? r.vote.party ?? "",
          photo: meta?.photo ?? null,
          title: r.bill?.billName ?? "법안 표결",
          subtitle: `${r.vote.voteResult} · ${r.bill?.committee ?? ""}`.trim(),
          billId: r.vote.billId,
          voteResult: r.vote.voteResult,
          occurredAt: (r.bill?.proposeDate || r.vote.syncedAt?.toISOString?.() || ""),
        };
      });

      const merged = [...billItems, ...voteItems]
        .filter((x) => x.occurredAt)
        .sort((a, b) => (b.occurredAt > a.occurredAt ? 1 : -1))
        .slice(0, limit);

      res.json({ items: merged, followCount: followRows.length });
    } catch (error) {
      console.error("feed error:", error);
      res.status(500).json({ error: "피드 조회 중 오류가 발생했습니다." });
    }
  });

  // ===== Instagram-style 통합 타임라인 =====
  // 팔로우 의원 활동 + 트렌딩 의원 활동(추천)을 시간순으로 섞어서 반환.
  // 비로그인 사용자도 전부 추천 피드로 사용 가능.

  app.get("/api/feed/timeline", async (req, res) => {
    try {
      const userId = req.session?.userId ?? null;
      const limit = Math.min(parseInt(String(req.query.limit ?? "20")) || 20, 50);

      const cacheKey = `${userId ?? "anon"}:${limit}`;
      const hit = timelineCache.get(cacheKey);
      if (hit && Date.now() - hit.cachedAt < TIMELINE_CACHE_TTL) {
        return res.json(hit.payload);
      }

      // 1) 팔로우한 의원 메타 조회 (로그인 시)
      const followed = userId
        ? await db
            .select({
              politicianId: userFollows.politicianId,
              name: legislators.name,
              party: legislators.party,
              photo: legislators.photoUrl,
            })
            .from(userFollows)
            .leftJoin(legislators, eq(userFollows.politicianId, legislators.monaCd))
            .where(eq(userFollows.userId, userId))
        : [];

      const followedIds = new Set(followed.map((f) => f.politicianId));
      const followedNameToMeta = new Map<string, { politicianId: string; name: string; party: string | null; photo: string | null }>();
      for (const f of followed) {
        if (f.name) {
          followedNameToMeta.set(f.name, {
            politicianId: f.politicianId,
            name: f.name,
            party: f.party,
            photo: f.photo,
          });
        }
      }

      // 2) 추천(트렌딩) 의원 — followerCount + 최근 뉴스 수 기준. 팔로우 중인 의원 제외.
      const trendingScore = dsql`(${legislators.followerCount} * 20 + ${legislators.recentNewsCount} * 5 + ${legislators.profileViewCount})`;
      const trendingRows = await db
        .select({
          monaCd: legislators.monaCd,
          name: legislators.name,
          party: legislators.party,
          photo: legislators.photoUrl,
        })
        .from(legislators)
        .orderBy(desc(trendingScore))
        .limit(20);

      const recNameToMeta = new Map<string, { politicianId: string; name: string; party: string | null; photo: string | null }>();
      for (const r of trendingRows) {
        if (!r.name || followedIds.has(r.monaCd)) continue;
        recNameToMeta.set(r.name, {
          politicianId: r.monaCd,
          name: r.name,
          party: r.party,
          photo: r.photo,
        });
      }

      // 3) 최근 발의 법안 — 대표발의자 이름으로 followed/recommended 매칭
      const recentBills = await db
        .select()
        .from(assemblyBills)
        .orderBy(desc(assemblyBills.proposeDate))
        .limit(150);

      const billItems = recentBills
        .map((bill) => {
          const primary = (bill.proposer || "").split("(")[0].split(",")[0].trim();
          const followedMeta = followedNameToMeta.get(primary);
          const recMeta = !followedMeta ? recNameToMeta.get(primary) : null;
          const meta = followedMeta ?? recMeta;
          if (!meta) return null;
          const summary = bill.aiDescription?.trim() || bill.billName;
          return {
            type: "bill" as const,
            id: `bill-${bill.billId}`,
            politicianId: meta.politicianId,
            politicianName: meta.name,
            party: meta.party,
            photo: meta.photo,
            title: bill.billName,
            summary,
            subtitle: bill.committee || "법안 발의",
            billId: bill.billId,
            occurredAt: bill.proposeDate || "",
            isRecommended: !followedMeta,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      // 4) 표결 (followed 의원만 — 표결은 너무 많아서 추천에는 포함하지 않음)
      const followedMonaCds = Array.from(followedIds);
      const voteItems = followedMonaCds.length > 0
        ? (
            await db
              .select({ vote: assemblyVotes, bill: assemblyBills })
              .from(assemblyVotes)
              .leftJoin(assemblyBills, eq(assemblyVotes.billId, assemblyBills.billId))
              .where(inArray(assemblyVotes.legislatorId, followedMonaCds))
              .orderBy(desc(assemblyVotes.syncedAt))
              .limit(80)
          ).map((r) => {
            const followedMeta = followed.find((f) => f.politicianId === r.vote.legislatorId);
            return {
              type: "vote" as const,
              id: `vote-${r.vote.id}`,
              politicianId: r.vote.legislatorId,
              politicianName: r.vote.legislatorName,
              party: followedMeta?.party ?? r.vote.party ?? "",
              photo: followedMeta?.photo ?? null,
              title: r.bill?.billName ?? "법안 표결",
              summary: `${r.vote.legislatorName} 의원이 「${r.bill?.billName ?? "법안"}」에 ${r.vote.voteResult} 의사를 표시했습니다.`,
              subtitle: `${r.vote.voteResult} · ${r.bill?.committee ?? ""}`.trim(),
              billId: r.vote.billId,
              voteResult: r.vote.voteResult,
              occurredAt: r.bill?.passedDate || r.bill?.proposeDate || r.vote.syncedAt?.toISOString?.() || "",
              isRecommended: false,
            };
          })
        : [];

      // 5) 머지 + 정렬. followed 우선 노출, 추천은 자연스럽게 사이사이 끼움.
      const merged = [...billItems, ...voteItems].filter((x) => x.occurredAt);

      const followedItems = merged.filter((m) => !m.isRecommended).sort((a, b) => (b.occurredAt > a.occurredAt ? 1 : -1));
      const recItems = merged.filter((m) => m.isRecommended).sort((a, b) => (b.occurredAt > a.occurredAt ? 1 : -1));

      let final = [];
      if (followedIds.size > 0) {
        // 사용자가 팔로우한 의원이 있을 경우: 팔로우 의원 활동을 상단에 몰아서 우선 노출
        // 이후 추천 항목들을 붙인다. 
        // 이렇게 해야 최근 활동이 뜸한 의원을 팔로우해도 피드 상단에서 확인할 수 있다.
        final = [...followedItems, ...recItems];
      } else {
        // 아무도 안 팔로우한 경우: 전체 추천 항목을 시간순으로 정렬
        final = recItems;
      }

      const payload = {
        items: final.slice(0, limit),
        followCount: followed.length,
        hasMore: final.length > limit,
      };
      timelineCache.set(cacheKey, { payload, cachedAt: Date.now() });
      res.json(payload);
    } catch (error) {
      console.error("timeline error:", error);
      res.status(500).json({ error: "타임라인 조회 중 오류가 발생했습니다." });
    }
  });

  app.post("/api/community/posts/:id/react", async (req, res) => {
    try {
      const { type } = req.body;
      const userId = getActorId(req);
      if (!["like", "dislike", "agree", "disagree"].includes(type)) {
        return res.status(400).json({ error: "잘못된 반응 유형입니다" });
      }
      await storage.addReaction(req.params.id as string, userId, type);
      const post = await storage.getPost(req.params.id as string);
      const userReactions = await storage.getUserReactions(req.params.id as string, userId);
      res.json({ post: post ? sanitizePost(post, userId) : null, userReactions });
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

      // 키워드 기반 카테고리 필터 (국회의원 뉴스 vs 법안 뉴스 분리)
      const { query, category } = req.query as Record<string, string>;

      if (category === "member") {
        // 국회의원/인물 관련 뉴스: 인물·정당 키워드가 있는 기사 우선
        const memberKeywords = ["의원", "국회의원", "대표", "원내", "당대표", "총리", "장관", "후보", "대통령", "인사", "사퇴", "출마", "지지", "탄핵", "체포", "소환", "당선", "지사", "시장", "구청장", "선거", "여당", "야당", "민주당", "국민의힘", "당선"];
        const billOnlyKeywords = ["법안", "개정안", "법률안", "시행령", "조례안"];
        items = items.filter((item) => {
          const title = item.title;
          const hasMemberKw = memberKeywords.some(kw => title.includes(kw));
          const isBillOnly = billOnlyKeywords.some(kw => title.includes(kw)) && !hasMemberKw;
          // 인물 키워드가 있으면 포함, 법안 전용 기사만 제외
          return !isBillOnly;
        });
      } else if (category === "bill") {
        // 법안/입법/정책 관련 뉴스: 넓은 범위의 입법·정책 키워드
        const billKeywords = ["법안", "개정안", "법률안", "개정", "시행령", "조례", "입법", "발의", "통과", "가결", "부결", "본회의", "상임위", "심의", "심사", "표결", "국회법", "예산", "추경", "예산안", "규제", "개편", "제도", "정책", "지원법", "특별법", "처리", "의결"];
        // 제외: 순수 인물 뉴스 (법안·정책과 무관한 것)
        const memberOnlyKeywords = ["출마", "사퇴", "당선", "유세", "선거구", "공천"];
        items = items.filter((item) => {
          const title = item.title;
          const hasBillKw = billKeywords.some(kw => title.includes(kw));
          const isMemberOnly = memberOnlyKeywords.some(kw => title.includes(kw)) && !hasBillKw;
          return hasBillKw && !isMemberOnly;
        });
      } else if (query) {
        // 기존 query 파라미터 방식 (하위 호환)
        const keywords = query.split(/\s+/).filter(Boolean);
        if (keywords.length > 0) {
          items = items.filter((item) =>
            keywords.some(kw => item.title.includes(kw))
          );
        }
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

  // 뉴스 분석 캐시 — 같은 기사는 한 번만 스크래핑/LLM 호출하고 이후 재사용(AI 비용 절감 핵심).
  // L1: 인메모리 LRU(재시작 전까지 즉답), L2: ai_cache 테이블(영속, 30일). + 동시 요청 dedup.
  const newsAnalysisCache = new LruMap<string, any>(500);
  const newsAnalysisInFlight = new Map<string, Promise<any>>();

  app.post("/api/news/analyze", async (req, res) => {
    try {
      const { url, title: clientTitle, source: clientSource } = req.body;
      if (!url && !clientTitle) {
        return res.status(400).json({ error: "URL 또는 제목이 필요합니다." });
      }

      // 캐시 키: URL 우선(쿼리스트링 제거로 동일 기사 통합), 없으면 제목.
      // v3 = 70B + 강화 프롬프트 + 순한글 지침 — 옛 캐시 무시하고 재생성.
      let cacheKey = "news:v3:";
      if (url) {
        try { const u = new URL(url); cacheKey += u.origin + u.pathname; }
        catch { cacheKey += String(url); }
      } else {
        cacheKey += `title:${clientTitle}`;
      }

      // L1
      const l1 = newsAnalysisCache.get(cacheKey);
      if (l1) return res.json({ success: true, data: l1, cached: "l1" });
      // L2 (DB 영속)
      const l2 = await getAiCache<any>(cacheKey);
      if (l2) {
        newsAnalysisCache.set(cacheKey, l2);
        return res.json({ success: true, data: l2, cached: "l2" });
      }
      // 동일 기사 동시 요청은 한 번만 분석하고 결과 공유
      if (newsAnalysisInFlight.has(cacheKey)) {
        const data = await newsAnalysisInFlight.get(cacheKey)!;
        return res.json({ success: true, data, cached: "inflight" });
      }

      const work = (async () => {
        let analysisTitle = clientTitle || "";
        let analysisContent = "";
        // 1. 스크래핑 시도 (실패해도 제목으로 폴백)
        if (url) {
          try {
            const article = await scrapeNewsArticle(url);
            if (article?.content && article.content.length >= 200) analysisContent = article.content;
            if (article?.title && !analysisTitle) analysisTitle = article.title;
          } catch (scrapeErr) {
            console.warn("[news/analyze] 스크래핑 실패, 제목만으로 분석:", scrapeErr);
          }
        }
        if (!analysisTitle) throw Object.assign(new Error("기사 제목을 확인할 수 없습니다."), { status: 400 });
        // 2. AI 분석 (본문 없어도 제목+출처만으로 수행)
        const analysis = await analyzeNewsWithAI(analysisTitle, analysisContent, clientSource);
        // 캐시 저장 (L1 즉시, L2 영속 30일)
        newsAnalysisCache.set(cacheKey, analysis);
        // TTL은 AI_CACHE_TTL_DAYS(기본 7일)로 통일 관리. 기사 본문은 불변이라 길수록 비용↓,
        // 실시간성을 더 원하면 AI_CACHE_TTL_DAYS=1(24h)로 설정.
        setAiCache(cacheKey, "news/analyze", analysis).catch(() => {});
        return analysis;
      })();
      newsAnalysisInFlight.set(cacheKey, work);

      try {
        const analysis = await work;
        res.json({ success: true, data: analysis });
      } finally {
        newsAnalysisInFlight.delete(cacheKey);
      }
    } catch (error: any) {
      console.error("News analyze error:", error);
      res.status(error.status || 500).json({ error: error.message || "뉴스 분석 중 오류가 발생했습니다." });
    }
  });

  // ===== 법안 AI 설명 생성 (On-Demand) =====
  // L1: 인메모리 캐시 (재시작 전까지 빠른 응답)
  const billDescCache = new LruMap<string, string>(1000);
  // 동일 법안 중복 AI 호출 방지용 in-flight 맵
  const billDescInFlight = new Map<string, Promise<string>>();
  // 동시 AI 호출 수 제한 (429 방어)
  let aiDescActive = 0;
  const AI_DESC_MAX_CONCURRENT = 2;

  // ===== 글로벌 AI 호출 큐 (Groq rate limit 방어) =====
  // 연속 AI 호출 사이에 최소 간격을 두어 rate limit 버스트를 방지한다.
  let lastAiCallTime = 0;
  const AI_CALL_MIN_GAP_MS = 800; // Groq 전용 스로틀 (분당 30 req 제한 방어)
  async function aiCallThrottle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - lastAiCallTime;
    if (elapsed < AI_CALL_MIN_GAP_MS) {
      await new Promise(r => setTimeout(r, AI_CALL_MIN_GAP_MS - elapsed));
    }
    lastAiCallTime = Date.now();
  }

  app.post("/api/bills/describe", async (req, res) => {
    try {
      const { billId, billName, committee, proposer } = req.body;
      if (!billName) return res.status(400).json({ error: "billName required" });

      const cacheKey = billId || billName;

      // L1: 인메모리 캐시
      if (billDescCache.has(cacheKey)) {
        return res.json({ description: billDescCache.get(cacheKey) });
      }

      // L2: DB 영속 캐시 (billId가 있을 때만)
      if (billId) {
        const rows = await db
          .select({ aiDescription: assemblyBills.aiDescription })
          .from(assemblyBills)
          .where(eq(assemblyBills.billId, billId))
          .limit(1);
        if (rows.length > 0 && rows[0].aiDescription) {
          billDescCache.set(cacheKey, rows[0].aiDescription);
          return res.json({ description: rows[0].aiDescription });
        }
      }

      // 동일 법안에 대한 in-flight 요청이 있으면 기다렸다가 결과 재사용
      if (billDescInFlight.has(cacheKey)) {
        try {
          const description = await billDescInFlight.get(cacheKey)!;
          return res.json({ description });
        } catch {
          return res.status(503).json({ error: "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", analyzing: false });
        }
      }

      // 동시 요청 수 초과 시 "분석 중" 응답 반환 (클라이언트가 재시도)
      if (aiDescActive >= AI_DESC_MAX_CONCURRENT) {
        return res.status(429).json({ error: "분석 요청이 많습니다. 잠시 후 다시 시도해주세요.", analyzing: true });
      }

      if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: "AI 서비스 사용 불가" });

      const generatePromise = (async () => {
        aiDescActive++;
        try {
          await aiCallThrottle(); // rate limit 방어 스로틀
          const context = [
            committee ? `소관위원회: ${committee}` : "",
            proposer ? `발의자: ${proposer}` : "",
          ].filter(Boolean).join(", ");

          return await callLLMText({
            system:
              "당신은 한국 국회 법안을 시민이 쉽게 이해하도록 설명하는 전문가입니다. " +
              "① 이 법안이 무엇을 바꾸려 하는지(목적), ② 시민 생활에 미치는 실제 영향을 " +
              "쉽고 구체적인 표현으로 3~4문장(180자 내외)으로 설명하세요. 전문용어는 풀어 쓰고, 다른 말은 하지 마세요.",
            user: `법안명: ${billName}${context ? `\n추가정보: ${context}` : ""}`,
            temperature: 0.3,
            maxTokens: 450,
            label: "bills/describe",
          });
        } finally {
          aiDescActive--;
        }
      })();

      billDescInFlight.set(cacheKey, generatePromise);

      try {
        const description = await generatePromise;
        billDescCache.set(cacheKey, description);

        // DB에 영속 저장 (백그라운드, billId 있을 때만)
        if (billId) {
          db.update(assemblyBills)
            .set({ aiDescription: description })
            .where(eq(assemblyBills.billId, billId))
            .catch((e: any) => console.error("[bills/describe] DB 저장 실패:", e.message));
        }

        return res.json({ description });
      } catch (error: any) {
        const is429 =
          (error instanceof LLMTransientError && error.status === 429) ||
          error?.status === 429 ||
          String(error?.message).includes("429") ||
          String(error?.message).includes("quota");
        if (is429) {
          console.warn("[bills/describe] Groq 429:", error.message);
          return res.status(429).json({ error: "AI 분석 한도 초과. 잠시 후 다시 시도해주세요.", analyzing: false });
        }
        console.error("[bills/describe] error:", error);
        return res.status(500).json({ error: error.message });
      } finally {
        billDescInFlight.delete(cacheKey);
      }
    } catch (error: any) {
      console.error("[bills/describe] unexpected error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== 법안 심층 AI 분석 (배경·수혜자·부담·영향) =====
  // bills/describe 가 한 줄 요약이라면, 여기는 "왜 나왔고 누구에게 어떤 영향인지" 구조화 분석.
  interface BillAnalysis {
    background: string;       // 발의 배경·취지
    beneficiaries: string;    // 혜택 보는 집단
    drawbacks: string;        // 부담·불리해지는 집단
    impact: string;           // 통과 시 예상 영향
    keyPoints: string[];      // 핵심 포인트
  }
  const billAnalysisCache = new LruMap<string, BillAnalysis>(1000);
  const billAnalysisInFlight = new Map<string, Promise<BillAnalysis>>();
  let billAnalysisActive = 0;
  const BILL_ANALYSIS_MAX_CONCURRENT = 3;

  app.post("/api/bills/analyze", async (req, res) => {
    try {
      const { billId, billName, committee, proposer, result, proposeDate } = req.body ?? {};
      if (!billName || typeof billName !== "string") {
        return res.status(400).json({ error: "billName 필요" });
      }

      const cacheKey = (billId && typeof billId === "string" ? billId : billName).trim();

      // L1: 인메모리 캐시
      const cached = billAnalysisCache.get(cacheKey);
      if (cached) return res.json(cached);

      // 동일 법안 in-flight 요청 재사용
      if (billAnalysisInFlight.has(cacheKey)) {
        try {
          return res.json(await billAnalysisInFlight.get(cacheKey)!);
        } catch {
          return res.status(503).json({ error: "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." });
        }
      }

      if (billAnalysisActive >= BILL_ANALYSIS_MAX_CONCURRENT) {
        return res.status(429).json({ error: "분석 요청이 많습니다. 잠시 후 다시 시도해주세요.", analyzing: true });
      }

      if (!process.env.GROQ_API_KEY) {
        return res.status(503).json({ error: "AI 서비스 미설정 (GROQ_API_KEY)" });
      }

      const ctx = [
        proposer ? `대표발의: ${String(proposer).split("(")[0].trim()}` : "",
        committee ? `소관위원회: ${committee}` : "",
        result ? `심사상태: ${result}` : "",
        proposeDate ? `발의일: ${proposeDate}` : "",
      ].filter(Boolean).join(" / ");

      const fallback: BillAnalysis = {
        background: "이 법안의 배경 분석을 일시적으로 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        beneficiaries: "분석 정보가 잠시 후 표시됩니다.",
        drawbacks: "분석 정보가 잠시 후 표시됩니다.",
        impact: "분석 정보가 잠시 후 표시됩니다.",
        keyPoints: [],
      };

      const generatePromise = (async (): Promise<BillAnalysis> => {
        billAnalysisActive++;
        try {
          return await callLLMJsonOrFallback<BillAnalysis>(
            {
              system:
                "당신은 대한민국 국회 법안을 시민 눈높이로 풀어 설명하는 정책 분석 전문가입니다. " +
                "법안명과 메타데이터만으로 합리적으로 추론하되, 단정적 허위사실은 피하고 일반적 경향으로 서술하세요. " +
                "정치적으로 중립적이어야 하며 특정 정당을 편들지 마세요. " +
                "반드시 아래 JSON 스키마와 정확히 동일한 키만 사용하고, 그 외 텍스트(설명·코드펜스)는 절대 포함하지 마세요. " +
                "모든 값은 한국어 평서문. background/impact는 2~3문장, beneficiaries/drawbacks는 1~2문장, keyPoints는 한 줄짜리 핵심 3개.\n" +
                '{"background":"발의 배경과 취지","beneficiaries":"이 법안으로 혜택을 보는 집단과 그 이유","drawbacks":"부담이 커지거나 불리해지는 집단과 그 이유","impact":"통과 시 사회·경제적으로 예상되는 영향","keyPoints":["핵심1","핵심2","핵심3"]}',
              user: `법안명: ${billName}${ctx ? `\n${ctx}` : ""}`,
              temperature: 0.4,
              maxTokens: 900,
              label: "bills/analyze",
              provider: "groq",
            },
            fallback,
          );
        } finally {
          billAnalysisActive--;
        }
      })();

      billAnalysisInFlight.set(cacheKey, generatePromise);

      try {
        const analysis = await generatePromise;
        // 폴백(생성 실패)은 캐시하지 않음 — 다음 요청에서 재시도 가능하도록.
        if (analysis !== fallback) {
          billAnalysisCache.set(cacheKey, analysis);
        }
        return res.json(analysis);
      } finally {
        billAnalysisInFlight.delete(cacheKey);
      }
    } catch (error: any) {
      console.error("[bills/analyze] error:", error);
      return res.status(500).json({ error: error?.message || "분석 실패" });
    }
  });

  // ===== 단독 공약 AI 분석 =====
  const pledgeAnalyzeCache = new LruMap<string, object>(1000);
  // 동일 공약 동시 요청 dedup — 진행 중인 분석 결과를 공유해 LLM 중복 호출 방지.
  const pledgeAnalyzeInFlight = new Map<string, Promise<Record<string, any> | null>>();

  // DB의 null/빈값을 LLM이 안전하게 처리할 수 있도록 통일된 placeholder 적용
  const orNoData = (v: unknown): string => {
    if (v === null || v === undefined) return "정보 없음";
    const s = String(v).trim();
    return s.length === 0 ? "정보 없음" : s;
  };

  const formatCriminalRecords = (raw: unknown): string => {
    if (!raw) return "정보 없음";
    if (Array.isArray(raw)) {
      if (raw.length === 0) return "전과 기록 없음";
      return raw
        .map((r: any, i: number) => {
          if (typeof r === "string") return `${i + 1}. ${r}`;
          const title = r?.title ?? r?.crime ?? r?.summary ?? "내용 미상";
          const date = r?.date ?? r?.year ?? "";
          return `${i + 1}. ${title}${date ? ` (${date})` : ""}`;
        })
        .join("\n");
    }
    return orNoData(raw);
  };

  // 후보 직위가 입법권한이 없는 단체장(시·도지사·구청장·교육감)인지 판정한다.
  // 광역/기초의원은 조례 발의 권한이 있으므로 약간 권한 가중치를 부여한다.
  const officeAuthorityHint = (job: string): string => {
    const j = job || "";
    if (/시장|도지사|군수|구청장|교육감/.test(j)) {
      return "이 후보는 단체장 후보로, 법률 제·개정 권한이 없다. 국회 입법이 필요한 공약은 권한 외이므로 실현가능성에서 큰 폭으로 감점한다.";
    }
    if (/시의원|도의원|구의원|군의원|의회의원/.test(j)) {
      return "이 후보는 지방의회 의원 후보로, 조례 제·개정 권한은 있으나 법률 개정·국가 예산은 직접 통제하지 못한다.";
    }
    return "후보 직위가 명확하지 않다. 공약이 지방정부 권한 내인지 보수적으로 판단한다.";
  };

  app.post("/api/candidates/analyze-pledge", aiLimiter, async (req, res) => {
    try {
      const body = req.body ?? {};
      const name = orNoData(body.name);
      const party = orNoData(body.party);
      const job = orNoData(body.job);
      const career1 = orNoData(body.career1);
      const criminalRecords = formatCriminalRecords(body.criminalRecords);

      // 구조화된 공약 입력 (선관위 공보 표준 필드).
      // 레거시 호환: body.pledge(문자열)만 와도 동작하나, method/funding/duration이 비면 점수가 강제로 50 미만이 된다.
      const pledgeTitle = orNoData(body.pledge ?? body.title);
      const realmName = orNoData(body.realmName ?? body.realm);
      const content = orNoData(body.content ?? body.description);
      const method = orNoData(body.method);
      const funding = orNoData(body.funding);
      const duration = orNoData(body.duration);

      if (pledgeTitle === "정보 없음") {
        return res.status(400).json({ error: "공약 내용이 필요합니다" });
      }

      const cacheKey = `analyze-pledge:v3:${[name, pledgeTitle, method, funding, duration].join("||")}`;
      const memHit = pledgeAnalyzeCache.get(cacheKey) as Record<string, any> | undefined;
      if (memHit?.detailedAxes) return res.json(memHit);
      // L2: DB 영속 캐시 — detailedAxes 없는 구버전은 무시하고 재실행
      const pledgeL2 = await getAiCache<Record<string, any>>(cacheKey);
      if (pledgeL2?.detailedAxes) { pledgeAnalyzeCache.set(cacheKey, pledgeL2); return res.json(pledgeL2); }

      // In-flight dedup: 같은 공약이 이미 분석 중이면 그 결과를 공유(중복 LLM 호출 방지).
      const inFlight = pledgeAnalyzeInFlight.get(cacheKey);
      if (inFlight) {
        const shared = await inFlight.catch(() => null);
        if (shared?.detailedAxes) return res.json(shared);
        // 진행 중 요청이 실패했으면 아래에서 직접 분석
      }
      // 이 요청을 in-flight 대표로 등록. 응답이 끝나면(성공/실패 무관) 해제 + 대기자 깨우기.
      let settleInFlight: (v: Record<string, any> | null) => void = () => {};
      pledgeAnalyzeInFlight.set(cacheKey, new Promise<Record<string, any> | null>((resolve) => { settleInFlight = resolve; }));
      res.on("finish", () => { settleInFlight(null); pledgeAnalyzeInFlight.delete(cacheKey); });
      res.on("close", () => { settleInFlight(null); pledgeAnalyzeInFlight.delete(cacheKey); });

      if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: "AI 서비스 미설정 (GROQ_API_KEY)" });

      // ⚠️ Fallback은 모델 응답이 *없을 때*만 쓰인다. 의도적으로 낮게 둔다.
      const fallback = {
        feasibilityScore: 35,
        feasibilityLabel: "낮음",
        authorityScore: 30,
        fundingScore: 25,
        timelineScore: 25,
        summary: "공약 텍스트만으로는 이행방법·재원·기간을 검증할 수 없습니다.",
        strengths: [],
        concerns: ["이행방법 미기재", "재원조달방안 미기재", "이행기간 미기재"],
        // 키 이름은 LLM에 주입하는 스키마와 일치(snake_case)
        feasibility_critique:
          "이행방법·재원조달방안·이행기간이 모두 '기재 안 됨' 상태로, 예산 확보 경로와 권한 범위를 확인할 수 없어 실현가능성이 불투명함.",
        voterTip: "지자체 예산서 및 조례 발의 내역을 검색하여 예산 편성 타당성과 법적 실행 권한을 직접 검증하십시오.",
        detailedAxes: {
          internalConsistency: { score: 1, analysis: "AI 분석 서버 연결 지연으로 정합성을 검증할 수 없습니다." },
          planSpecificity: { score: 1, analysis: "구체적 이행계획을 파악하기 어렵습니다." },
          financialFeasibility: { score: 1, analysis: "재원 규모와 조달 방안 검증이 누락되었습니다." },
          economicViability: { score: 1, analysis: "경제적 파급효과와 타당성을 확인할 수 없습니다." },
          precedentVerification: { score: 1, analysis: "유사 선례에 대한 데이터가 확보되지 않았습니다." }
        },
        keyVulnerability: "AI 분석 서버 응답 지연으로 심층 평가가 제한되었습니다."
      };

      // 미기재(빈/null/"정보 없음")는 LLM에게 "기재 안 됨"으로 명시 전달
      const ND = "기재 안 됨";
      const orNotProvided = (v: string): string =>
        v === "정보 없음" || !v.trim() ? ND : v.trim();

      const blockTitle = orNotProvided(pledgeTitle);
      const blockMethod = orNotProvided(method);
      const blockFunding = orNotProvided(funding);
      const blockDuration = orNotProvided(duration);
      const blockRealm = orNotProvided(realmName);
      const blockContent = orNotProvided(content);

      const SYSTEM_PROMPT = [
        "당신은 비당파 정책감사기관의 수석 분석관입니다. 후보자의 공약 '제목'이나 '의도'는 평가하지 마십시오. 오직 이행방법·재원조달방안·이행기간의 구체성과 실현가능성만 데이터 기반으로 봅니다.",
        "",
        "[엄격 채점 규칙]",
        "1. 재원조달방안이 '기재 안 됨'이거나 '국비 확보', '민자 유치' 등 구체적인 세수(Tax) 계획 없이 막연하다면 실현가능성 점수를 40점 이하로 대폭 깎으십시오.",
        "2. 이행방법에 법률 개정(국회 권한)이 필요한데 본인이 지자체장(시장/도지사) 후보라면 권한 밖이므로 점수를 깎으십시오.",
        "3. 평가 코멘트(feasibility_critique)에는 팩트 기반의 비판을 1~2줄로 강하게 적으십시오.",
        "",
        "[채점 축 — 항목별 0~100. 최종 feasibilityScore는 가중평균(권한 0.30, 재원 0.45, 기간 0.25) 정수.]",
        "A. authorityScore (권한): 후보 직위의 법적 권한 안에서 단독 실행 가능한가. 법률 개정·국가예산 신설 필요 시 30점 이하.",
        "B. fundingScore (재원): 구체 세입 출처·금액·연차로 검증 가능한가. '국비 확보' '민자 유치' '예산 절감'은 25점 이하.",
        "C. timelineScore (기간): 임기 4년 내 분기·연차별 마일스톤이 명시되어 있는가. '추진' '검토' '단계적'만 있으면 25점 이하.",
        "",
        "[5축 정밀 평가 — 각 항목 1~5점(정수) + 3~4문장 분석]",
        "아래 5개 축을 detailedAxes 객체 안에 포함시켜라. 각 축은 {score: 1~5 정수, analysis: '3~4문장 한국어 평가'} 형태이다.",
        "★ 중요: 입력에 일부 정보가 '기재 안 됨'이어도, 당신이 보유한 정책·행정·경제 지식과 실제 국내외 사례를 적극 활용해 '구체적이고 서로 다른' 분석을 작성하라. '데이터가 없다/고려되지 않았다/확인할 수 없다'는 식의 회피성 문장은 금지한다. 각 축마다 그 축에 고유한 근거를 제시하라.",
        "1. internalConsistency (내부 정합성): 공약의 목표·이행방법·재원·일정이 서로 논리적으로 맞물리는가? 목표 규모에 비해 수단이 과소/과대하지 않은가? 내부 모순을 구체적으로 지적하라.",
        "2. planSpecificity (이행계획 구체성): 단계별·연차별 계획이 구체적인가, 선언적 수준인가? 후보 고유 전략인지 기존 정부 계획 인용인지 판단하라.",
        "3. financialFeasibility (재정 실현가능성): 재원 수단(국비/지방비/민자)의 현실성, 추정 총사업비 규모, 유사 사업의 예산 초과 경향을 당신의 지식으로 추정해 평가하라.",
        "4. economicViability (경제적 타당성): 이 공약이 창출할 경제적 파급효과·편익과 비용을 일반 경제 원리와 유사 사례로 추론하고, 핵심 리스크 변수를 제시하라.",
        "5. precedentVerification (선례 검증): 이 공약과 유사한 국내외 정책·사업(예: 행정통합·메가시티·광역교통망·물류특구 등)의 실제 성공/실패 사례를 1개 이상 구체적으로 언급하고, 그로부터 이 공약의 성패 가능성을 추론하라. 절대 '선례가 고려되지 않았다'고 쓰지 말 것.",
        "",
        "[추가 룰]",
        "• 구조화 필드(이행방법·재원조달·이행기간)가 '기재 안 됨'이어도 '목표/내용' 본문에 이행수단·재원·일정에 대한 단서가 있으면 그것을 근거로 점수를 차등 부여하라. 본문에도 단서가 전혀 없을 때에만 feasibilityScore 50점 상한을 적용한다. (모든 공약을 일률적으로 50점으로 만들지 말 것)",
        "• detailedAxes의 5개 축 점수를 기계적으로 통일하지 마십시오 (예: 전부 2점으로 도배 금지). 정보가 부족하더라도 각 축의 고유한 특성을 반영해 점수(1~5)를 차등 부여하십시오.",
        "• 의도·비전·필요성에 가산점 금지. strengths에는 검증 가능한 실행 메커니즘만 적는다.",
        "• 후보 경력·정당·현직은 가산점 사유가 아니다. 정당명·이념·인신을 평가 근거로 쓰지 않는다.",
        "• feasibilityLabel은 점수와 엄격히 연동: 75+ '높음', 55-74 '중간', 35-54 '보통', 0-34 '낮음'.",
        "• voterTip에는 유권자가 후보에게 질문하는 형식을 사용하지 마십시오. 대신, 이 공약의 실현 가능성을 유권자가 직접 검증/행동할 수 있는 구체적인 행동 방안(예: 정보공개청구, 선관위 자료 확인, 지자체 예산안/조례 검색 등)을 1~2문장으로 제시하십시오.",
        "• keyVulnerability에는 이 공약의 가장 큰 구조적 약점을 2~3문장으로 적는다.",
        "• 모든 텍스트는 한자·중국어·일본어 표기 없이 순한글로만 작성한다(예: '大量'→'대량', '参考'→'참고'). 숫자와 인명·고유명사는 예외.",
        "",
        "[출력 — 아래 JSON 스키마와 정확히 동일한 키만 사용. 코드펜스·접두어·설명문 금지.]",
        '{"feasibilityScore":<0-100 정수>,"feasibilityLabel":"높음|중간|보통|낮음","authorityScore":<0-100>,"fundingScore":<0-100>,"timelineScore":<0-100>,"summary":"공약 핵심 1문장(중립적 사실)","strengths":["검증 가능한 실행 요소만; 없으면 빈 배열"],"concerns":["구체 약점 — 권한/재원/기간 중 어느 축이 부족한지 명시"],"feasibility_critique":"팩트 기반 1~2줄 비판","voterTip":"유권자가 이 공약의 실현 여부를 검증/감시할 수 있는 구체적인 감시 및 행동 방안 1~2문장","keyVulnerability":"이 공약의 가장 큰 구조적 약점 2~3문장","detailedAxes":{"internalConsistency":{"score":<1-5>,"analysis":"3~4문장 구체적 분석"},"planSpecificity":{"score":<1-5>,"analysis":"3~4문장 구체적 분석"},"financialFeasibility":{"score":<1-5>,"analysis":"3~4문장 구체적 분석"},"economicViability":{"score":<1-5>,"analysis":"3~4문장 구체적 분석"},"precedentVerification":{"score":<1-5>,"analysis":"실제 유사 사례를 든 3~4문장"}}}',
      ].join("\n");

      // 사용자 명시 포맷 — [공약 1] {title} / - 이행방법 / - 재원조달 / - 이행기간
      const pledgeBlock =
        `[공약 1] ${blockTitle}\n` +
        `- 이행방법: ${blockMethod}\n` +
        `- 재원조달: ${blockFunding}\n` +
        `- 이행기간: ${blockDuration}`;

      const userPrompt =
        `[후보자]\n` +
        `- 이름: ${name}\n` +
        `- 정당: ${party}\n` +
        `- 현직: ${job}\n` +
        `- 직위 권한 참고: ${officeAuthorityHint(job)}\n` +
        `- 주요 경력: ${career1}\n` +
        `- 전과 기록: ${criminalRecords}\n\n` +
        `${pledgeBlock}\n` +
        `(분야: ${blockRealm} · 목표/내용: ${blockContent})\n\n` +
        `위 채점 규칙에 따라 평가하라. 구조화 필드가 비어 있어도 '목표/내용' 본문의 단서를 적극 활용해 차등 채점하고, detailedAxes 5개 축은 모두 당신의 정책·경제 지식과 실제 유사 사례를 근거로 구체적으로 서술하라(회피 문장 금지). 반드시 5개 축 모두 포함하라.`;

      await aiCallThrottle(); // rate limit 방어 스로틀
      const rawResult = await callLLMJsonOrFallback<Record<string, any>>(
        {
          system: SYSTEM_PROMPT,
          user: userPrompt,
          temperature: 0.3,
          maxTokens: 2400,
          label: "candidates/analyze-pledge",
          provider: "groq",
          model: "llama-3.3-70b-versatile",
        },
        fallback,
      );

      // 모델이 snake_case로 반환하면 camelCase로 미러링 (프론트 호환)
      const critique =
        rawResult?.feasibility_critique ?? rawResult?.feasibilityCritique ?? null;
      const result: Record<string, any> = {
        ...rawResult,
        feasibility_critique: critique,
        feasibilityCritique: critique,
      };

      // 폴백(LLM 실패)은 캐시하지 않음 — 다음 요청에서 LLM 재시도 가능하도록
      if (rawResult !== fallback) {
        pledgeAnalyzeCache.set(cacheKey, result);
        setAiCache(cacheKey, "analyze-pledge", result).catch((e: unknown) =>
          console.error("[analyze-pledge] DB 캐시 저장 실패:", (e as Error).message),
        );
      } else {
        // 폴백 응답에 플래그 추가 — 프론트엔드에서 감지 후 재시도
        result._isFallback = true;
      }
      // in-flight 대기자에게 결과 공유 (폴백이 아닌 정상 결과만)
      settleInFlight(result._isFallback ? null : result);
      res.json(result);
    } catch (error: any) {
      console.error("[analyze-pledge] error:", error);
      res.status(200).json({
        _isFallback: true,
        feasibilityScore: 35,
        feasibilityLabel: "낮음",
        authorityScore: 0,
        fundingScore: 0,
        timelineScore: 0,
        summary: "AI 분석 서비스가 일시적으로 응답하지 않습니다.",
        strengths: [],
        concerns: ["분석 결과를 검증할 수 없어 보수적으로 낮음 처리"],
        feasibility_critique: "외부 분석기 응답 실패 — 후보 공약의 구체성을 직접 확인하세요.",
        feasibilityCritique: "외부 분석기 응답 실패 — 후보 공약의 구체성을 직접 확인하세요.",
        voterTip: "",
        keyVulnerability: "AI 분석 서비스에 접근할 수 없어 공약의 구조적 약점을 평가할 수 없습니다.",
        detailedAxes: {
          internalConsistency: { score: 1, analysis: "AI 분석 서버 연결 지연으로 정합성을 검증할 수 없습니다." },
          planSpecificity: { score: 1, analysis: "구체적 이행계획을 파악하기 어렵습니다." },
          financialFeasibility: { score: 1, analysis: "재원 규모와 조달 방안 검증이 누락되었습니다." },
          economicViability: { score: 1, analysis: "경제적 파급효과와 타당성을 확인할 수 없습니다." },
          precedentVerification: { score: 1, analysis: "유사 선례에 대한 데이터가 확보되지 않았습니다." }
        },
      });
    }
  });

  // ===== 공약 AI 비교 분석 =====
  const pledgeCompareCache = new LruMap<string, object>(500);

  app.post("/api/candidates/compare-pledges", aiLimiter, async (req, res) => {
    try {
      const body = req.body ?? {};
      const rawA = body.candidateA ?? {};
      const rawB = body.candidateB ?? {};

      const normalize = (c: any) => ({
        name: orNoData(c?.name),
        party: orNoData(c?.party),
        pledge: orNoData(c?.pledge),
        job: orNoData(c?.job),
        career1: orNoData(c?.career1),
      });

      const candidateA = normalize(rawA);
      const candidateB = normalize(rawB);

      if (candidateA.pledge === "정보 없음" && candidateB.pledge === "정보 없음") {
        return res.status(400).json({ error: "두 후보의 공약이 필요합니다" });
      }

      const cacheKey = `compare-pledges::${candidateA.name}::${candidateA.pledge}||${candidateB.name}::${candidateB.pledge}`;
      if (pledgeCompareCache.has(cacheKey)) {
        return res.json(pledgeCompareCache.get(cacheKey));
      }
      const compareL2 = await getAiCache<object>(cacheKey);
      if (compareL2) { pledgeCompareCache.set(cacheKey, compareL2); return res.json(compareL2); }

      if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: "AI 서비스 미설정 (GROQ_API_KEY)" });

      const buildCandidateBlock = (c: ReturnType<typeof normalize>, label: string) =>
        `[${label}] ${c.name} / ${c.party}\n` +
        `- 현직: ${c.job}\n` +
        `- 주요 경력: ${c.career1}\n` +
        `- 공약: ${c.pledge}`;

      const fallback = {
        coreContrast: `${candidateA.name}와 ${candidateB.name}는 서로 다른 방향의 정책을 제시하고 있습니다. 두 후보의 공약을 꼼꼼히 비교해보세요.`,
        candidateAHighlights: candidateA.pledge !== "정보 없음" ? [candidateA.pledge] : [],
        candidateBHighlights: candidateB.pledge !== "정보 없음" ? [candidateB.pledge] : [],
        voterGuide: "",
      };

      const result = await callLLMJsonOrFallback<object>(
        {
          system:
            "당신은 대한민국 지방선거 공약을 비교 분석하는 중립적인 정치 전문가입니다. " +
            "절대로 출력 결과(coreContrast, Highlights, voterGuide 등)에서 'A후보', 'B후보', '후보 1', '후보 2' 등의 임시 명칭을 사용하지 마세요. 대신 입력에 제공된 후보의 실제 이름(예: '오중기 후보', '이철우 후보')을 명시하여 분석 내용을 작성해 주세요. " +
            "입력값 중 일부는 '정보 없음' 으로 표시될 수 있습니다. 그 경우 해당 항목은 분석에서 제외하고 다른 정보로 판단하세요. " +
            "반드시 아래 JSON 스키마와 정확히 동일한 키만 사용하여 출력하세요. 다른 텍스트(설명, 코드펜스 포함)는 절대 포함하지 마세요.\n" +
            '{"coreContrast":"핵심 차이 2-3문장","candidateAHighlights":["특징1","특징2"],"candidateBHighlights":["특징1","특징2"],"voterGuide":"유권자 고려사항 1-2문장"}',
          user:
            `${buildCandidateBlock(candidateA, `${candidateA.name} 후보`)}\n\n` +
            `${buildCandidateBlock(candidateB, `${candidateB.name} 후보`)}`,
          temperature: 0.3,
          maxTokens: 700,
          label: "candidates/compare-pledges",
          provider: "openai",
        },
        fallback,
      );

      if (result !== fallback) {
        pledgeCompareCache.set(cacheKey, result);
        setAiCache(cacheKey, "compare-pledges", result).catch(() => {});
      }
      res.json(result);
    } catch (error: any) {
      console.error("[compare-pledges] error:", error);
      const { candidateA, candidateB } = req.body ?? {};
      res.status(200).json({
        coreContrast: `${candidateA?.name ?? "A후보"}와 ${candidateB?.name ?? "B후보"}의 공약 차이를 AI가 분석하지 못했습니다.`,
        candidateAHighlights: candidateA?.pledge ? [candidateA.pledge] : [],
        candidateBHighlights: candidateB?.pledge ? [candidateB.pledge] : [],
        voterGuide: "",
      });
    }
  });

  // ===== 분야별 공약 통합 분석 =====
  app.post("/api/candidates/analyze-topic", aiLimiter, async (req, res) => {
    try {
      const body = req.body ?? {};
      const topic = orNoData(body.topic);
      const rawCandidates: any[] = Array.isArray(body.candidates) ? body.candidates : [];

      if (topic === "정보 없음" || rawCandidates.length === 0) {
        return res.status(400).json({ error: "분야와 후보자 정보가 필요합니다" });
      }

      const candidates = rawCandidates.map((c) => ({
        name: orNoData(c?.name),
        party: orNoData(c?.party),
        pledge: orNoData(c?.pledge),
        job: orNoData(c?.job),
        career1: orNoData(c?.career1),
      }));

      const hasAnyPledge = candidates.some((c) => c.pledge !== "정보 없음");
      if (!hasAnyPledge) {
        return res.status(200).json({
          summary: `${topic} 분야에 등록된 공약 데이터가 아직 없습니다.`,
          candidateAnalyses: candidates.map((c) => ({
            name: c.name,
            party: c.party,
            strength: "공약 데이터 미등록",
            comparison: "추후 등록 후 다시 확인해 주세요",
          })),
          voterTip: "후보자 공약은 선관위 공식 공보가 등록되면 자동으로 업데이트됩니다.",
        });
      }

      if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: "AI 서비스 미설정 (GROQ_API_KEY)" });

      const candidatesText = candidates
        .map(
          (c) =>
            `[${c.name} / ${c.party}]\n` +
            `- 현직: ${c.job}\n` +
            `- 주요 경력: ${c.career1}\n` +
            `- 공약: ${c.pledge}`,
        )
        .join("\n\n");

      const fallback = {
        summary: `${topic} 분야 후보자 공약 AI 분석 결과를 일시적으로 생성하지 못했습니다.`,
        candidateAnalyses: candidates.map((c) => ({
          name: c.name,
          party: c.party,
          strength: c.pledge !== "정보 없음" ? c.pledge : "공약 데이터 미등록",
          comparison: "추가 분석 정보가 잠시 후 표시됩니다",
        })),
        voterTip: "지자체 예산 집행 현황과 법정 계획 수립 여부를 조회하여 각 후보의 공약 실현 기반을 직접 검증하십시오.",
      };

      const result = await callLLMJsonOrFallback<object>(
        {
          system:
            `당신은 대한민국 지방선거 ${topic} 분야 전문가입니다. ` +
            "입력값 중 일부는 '정보 없음' 으로 표시될 수 있습니다. 그 경우 해당 항목은 분석에서 제외하고 다른 정보로 판단하세요. " +
            "반드시 아래 JSON 스키마와 정확히 동일한 키만 사용하여 출력하세요. 다른 텍스트(설명, 코드펜스 포함)는 절대 포함하지 마세요. " +
            "candidateAnalyses 배열의 길이와 순서는 입력된 후보자 순서와 동일해야 합니다.\n" +
            '{"summary":"공약 구도 2-3문장","candidateAnalyses":[{"name":"이름","party":"정당","strength":"핵심 장점 1-2문장","comparison":"차별점 1-2문장"}],"voterTip":"유권자가 각 후보 공약의 실현 가능성을 직접 비교/검증하기 위한 구체적인 검증 및 행동 방안 1~2문장 (질문하는 대신 구체적인 정보 조회처, 조례 및 조세 확인 방식 등 실천적인 검증법 제시)"}',
          user: `${topic} 분야 후보자 공약 비교:\n\n${candidatesText}`,
          temperature: 0.3,
          maxTokens: 1000,
          label: "candidates/analyze-topic",
          provider: "groq",
        },
        fallback,
      );

      res.json(result);
    } catch (error: any) {
      console.error("[analyze-topic] error:", error);
      const topic = orNoData(req.body?.topic);
      res.status(200).json({
        summary: `${topic} 분야 AI 분석 결과를 일시적으로 가져오지 못했습니다.`,
        candidateAnalyses: [],
        voterTip: "잠시 후 다시 시도해 주세요.",
      });
    }
  });

  // ===== 국회의원 프리미엄 AI 프로필 분석 =====
  const memberProfileCache = new LruMap<string, object>(500);

  app.get("/api/members/analyze-profile", aiLimiter, async (req, res) => {
    try {
      const monaCd = String(req.query.monaCd ?? "");
      if (!monaCd) return res.status(400).json({ error: "monaCd 필요" });

      if (memberProfileCache.has(monaCd)) return res.json(memberProfileCache.get(monaCd));
      // L2: DB 영속 캐시
      const profileCacheKey = `analyze-profile::${monaCd}`;
      const profileL2 = await getAiCache<object>(profileCacheKey);
      if (profileL2) { memberProfileCache.set(monaCd, profileL2); return res.json(profileL2); }

      if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: "AI 서비스 미설정 (GROQ_API_KEY)" });

      // 의원 기본정보
      const memberRows = await db
        .select({ name: legislators.name, party: legislators.party, district: legislators.district })
        .from(legislators)
        .where(eq(legislators.monaCd, monaCd))
        .limit(1);
      if (memberRows.length === 0) return res.status(404).json({ error: "의원을 찾을 수 없습니다" });
      const member = memberRows[0];

      // 표결 기록 (최근 40건, 법안명 포함) — DB 우선, 부족하면 라이브 API 폴백
      let voteRows = await db
        .select({
          billName: assemblyBills.billName,
          committee: assemblyBills.committee,
          voteResult: assemblyVotes.voteResult,
        })
        .from(assemblyVotes)
        .leftJoin(assemblyBills, eq(assemblyVotes.billId, assemblyBills.billId))
        .where(eq(assemblyVotes.legislatorId, monaCd))
        .limit(40);

      // DB가 비어있으면 in-memory 표결 인덱스에서 실시간 조합 (서버 startup prefetch 결과)
      if (voteRows.length < 3) {
        const indexed = legislatorVotesIndex.get(monaCd);
        if (indexed && indexed.length > 0) {
          voteRows = indexed.slice(0, 40).map((v) => ({
            billName: v.billName,
            committee: "",
            voteResult: v.voteResult,
          }));
        }
      }

      // 임계치 완화 (5 → 3). 3건 미만이면 분석 불가가 아니라 일반화된 기본 응답 반환.
      if (voteRows.length < 3) {
        return res.status(422).json({
          error: "표결 데이터가 충분하지 않습니다 (최소 3건 필요). DB 동기화가 필요할 수 있습니다.",
          hint: "터미널에서 `npm run enrich:assembly-records` 실행",
          monaCd,
        });
      }

      const voteSummary = voteRows
        .filter(v => v.billName)
        .map(v => `${v.voteResult}: ${v.billName}${v.committee ? ` (${v.committee})` : ""}`)
        .join("\n");

      const profileSchema =
        "당신은 대한민국 국회의원의 표결 기록을 분석하는 중립적인 정치 전문가입니다. " +
        "반드시 아래 JSON 스키마만 출력하세요. 다른 텍스트는 절대 포함하지 마세요.\n" +
        JSON.stringify({
          summary: "경제 분야에서 친기업·규제완화 성향이 뚜렷하며, 재정 건전성을 중시합니다. (1문장, 50자 이내)",
          orientation: { economy: 7, government: 3 },
          topInterests: [
            { field: "경제", percentage: 45 },
            { field: "복지", percentage: 30 },
            { field: "교육", percentage: 25 },
          ],
          crucialBills: [
            { billName: "중대재해처벌법 개정안", reason: "기업 규제 완화에 찬성 표결을 던짐" },
            { billName: "법안명2", reason: "이유2" },
            { billName: "법안명3", reason: "이유3" },
          ],
        }) +
        "\n\norientation.economy: 0=친노동/시장개입, 10=친기업/규제완화\n" +
        "orientation.government: 0=큰정부/복지확대, 10=작은정부/감세\n" +
        "topInterests: 관심분야 TOP3, 합계 100\n" +
        "crucialBills: 성향 파악에 결정적인 법안 3개";

      try {
        const result = await callLLMJson<object>({
          system: profileSchema,
          user:
            `의원: ${member.name} (${member.party} / ${member.district})\n\n` +
            `최근 표결 기록 (${voteRows.length}건):\n${voteSummary}`,
          temperature: 0.2,
          maxTokens: 700,
          label: "members/analyze-profile",
          provider: "openai",
        });
        memberProfileCache.set(monaCd, result);
        setAiCache(profileCacheKey, "analyze-profile", result).catch((e: unknown) =>
          console.error("[analyze-profile] DB 캐시 저장 실패:", (e as Error).message),
        );
        res.json(result);
      } catch (err) {
        if (err instanceof LLMParseError) return res.status(500).json({ error: "분석 결과 파싱 실패" });
        throw err;
      }
    } catch (error: any) {
      console.error("[members/analyze-profile] error:", error);
      res.status(500).json({ error: error.message ?? "분석 실패" });
    }
  });

  // ===== Premium AI 데이터 기반 평가 (POST /api/ai/evaluate) =====
  // 3대 데이터 소스(대표 발의 법안 / 본회의 표결 / 최근 뉴스)를 모아
  // LLM에 strict-neutrality 시스템 프롬프트와 함께 주입하고
  // newsEvidence 까지 포함된 정형 JSON 응답을 돌려준다.
  //
  // Request body:
  //   { monaCd: string }                          — DB 등록된 의원
  //   또는 { politicianName: string }              — 후보자/비등록자
  //   또는 { monaCd, politicianName }              — 둘 다 명시
  app.post("/api/ai/evaluate", aiLimiter, async (req, res) => {
    try {
      const monaCd = typeof req.body?.monaCd === "string" ? req.body.monaCd.trim() : "";
      const explicitName =
        typeof req.body?.politicianName === "string" ? req.body.politicianName.trim() : "";

      if (!monaCd && !explicitName) {
        return res.status(400).json({ error: "monaCd 또는 politicianName 중 하나는 필요합니다." });
      }

      if (!process.env.GROQ_API_KEY) {
        return res.status(503).json({ error: "AI 서비스 미설정 (GROQ_API_KEY)" });
      }

      // ── 1. 의원 식별 (monaCd가 있으면 DB에서 정식 이름 사용) ──
      let politicianName = explicitName;
      let party = "";
      let district = "";

      if (monaCd) {
        const [member] = await db
          .select({ name: legislators.name, party: legislators.party, district: legislators.district })
          .from(legislators)
          .where(eq(legislators.monaCd, monaCd))
          .limit(1);
        if (!member && !explicitName) {
          return res.status(404).json({ error: "의원을 찾을 수 없습니다." });
        }
        if (member) {
          politicianName = member.name;
          party = member.party;
          district = member.district;
        }
      }

      // ── 2. 데이터 소스 #1 : 대표 발의 법안 (최근 10건) ──
      const proposedBillsRows = politicianName
        ? await db
            .select({
              billName: assemblyBills.billName,
              committee: assemblyBills.committee,
              proposeDate: assemblyBills.proposeDate,
              result: assemblyBills.result,
              category: assemblyBills.category,
              aiDescription: assemblyBills.aiDescription,
            })
            .from(assemblyBills)
            .where(dsql`${assemblyBills.proposer} LIKE ${politicianName + "%"}`)
            .orderBy(desc(assemblyBills.proposeDate))
            .limit(10)
        : [];

      const proposedBills = proposedBillsRows.map((b) => ({
        title: b.billName,
        committee: b.committee,
        date: b.proposeDate,
        result: b.result,
        category: b.category,
        summary: (b.aiDescription ?? "").slice(0, 200),
      }));

      // ── 3. 데이터 소스 #2 : 본회의 표결 기록 (최근 20건, 핵심 필드만) ──
      const voteRowsForEval = monaCd
        ? await db
            .select({
              billName: assemblyBills.billName,
              voteResult: assemblyVotes.voteResult,
            })
            .from(assemblyVotes)
            .leftJoin(assemblyBills, eq(assemblyVotes.billId, assemblyBills.billId))
            .where(eq(assemblyVotes.legislatorId, monaCd))
            .orderBy(desc(assemblyBills.proposeDate))
            .limit(20)
        : [];

      const votingRecords = voteRowsForEval
        .filter((v) => v.billName && (v.voteResult === "찬성" || v.voteResult === "반대"))
        .map((v) => ({
          bill_title: v.billName as string,
          vote_result: v.voteResult,
        }));

      // ── 4. 데이터 소스 #3 : 최근 뉴스 / 발언 ──
      const newsItems: RecentNewsItem[] = politicianName
        ? await fetchRecentNews(politicianName, 10)
        : [];

      const recentNews = newsItems.map((n) => ({
        title: n.title,
        description: (n.description ?? "").slice(0, 150),
        date: n.pubDate,
      }));

      // ── 5. 데이터 가용성 가드 ──
      if (proposedBills.length === 0 && votingRecords.length === 0 && recentNews.length === 0) {
        return res.status(422).json({
          error: "분석할 데이터가 부족합니다. 발의 법안·표결·뉴스가 모두 비어있습니다.",
          politicianName,
        });
      }

      // ── 6. L2 캐시 확인 (DB 영속) ──
      const evaluateCacheKey = `evaluate::${monaCd || politicianName}`;
      const cachedEval = await getAiCache<EvaluatePayload>(evaluateCacheKey);
      if (cachedEval) {
        return res.json({ ...cachedEval, dataCounts: { proposedBills: proposedBills.length, votingRecords: votingRecords.length, recentNews: recentNews.length } });
      }

      // ── 7. LLM 페이로드 직렬화 (compact — 토큰 절약) ──
      const userPayload = JSON.stringify({
        politician: { name: politicianName, party, district },
        bills: proposedBills,
        votes: votingRecords,
        news: recentNews,
      });

      // ── 8. LLM 호출 (객관성 최우선 — temperature 최소화) ──
      try {
        const result = await callLLMJson<EvaluatePayload>({
          system: STRICT_NEUTRALITY_SYSTEM_PROMPT,
          user: userPayload,
          temperature: 0.1,
          maxTokens: 900,
          label: "ai/evaluate",
          provider: "openai",
        });

        setAiCache(evaluateCacheKey, "evaluate", result).catch(() => {});

        return res.json({
          ...result,
          dataCounts: {
            proposedBills: proposedBills.length,
            votingRecords: votingRecords.length,
            recentNews: recentNews.length,
          },
        });
      } catch (err) {
        if (err instanceof LLMParseError) {
          return res.status(500).json({ error: "AI 응답 파싱 실패" });
        }
        if (err instanceof LLMTransientError) {
          return res.status(503).json({ error: "AI 서비스가 일시적으로 응답하지 않습니다." });
        }
        throw err;
      }
    } catch (error: any) {
      console.error("[ai/evaluate] error:", error);
      res.status(500).json({ error: error.message ?? "AI 평가 실패" });
    }
  });

  // ===== 후보 객관 평가 리포트 (앱 실데이터 기반) =====
  // GET /api/candidates/evaluation-report?name=<후보명>&party=<선택>
  //   국회 경력자  → 표결 기록 + 대표발의 법안 + 소속 상임위 (assembly_votes/bills)
  //   비국회(행정가·법조인) → 선관위 등록 경력 + 공약 + 행보 (election_candidates/statements)
  // LLM은 수집된 FACTS 안에서만 서술하며, 근거 없는 항목은 dataGaps로 명시한다.
  app.get("/api/candidates/evaluation-report", async (req, res) => {
    try {
      const name = String(req.query.name ?? "").trim();
      const party = req.query.party ? String(req.query.party).trim() : undefined;
      if (!name) return res.status(400).json({ error: "name 쿼리 파라미터가 필요합니다." });
      if (!process.env.GROQ_API_KEY) {
        return res.status(503).json({ error: "AI 서비스 미설정 (GROQ_API_KEY)" });
      }

      const envelope = await generateCandidateReport(name, party);
      return res.json(envelope);
    } catch (err: any) {
      if (err instanceof CandidateNotFoundError) return res.status(404).json({ error: err.message });
      if (err instanceof InsufficientDataError) return res.status(422).json({ error: err.message });
      if (err instanceof LLMParseError) return res.status(500).json({ error: "리포트 파싱 실패" });
      if (err instanceof LLMTransientError) {
        return res.status(503).json({ error: "AI 서비스가 일시적으로 응답하지 않습니다." });
      }
      console.error("[candidates/evaluation-report] error:", err);
      return res.status(500).json({ error: err?.message ?? "리포트 생성 실패" });
    }
  });

  // ===== 선거 주요 일정 (election_schedules) =====
  // GET  /api/schedules?region=서울  → 미래 일정만 가까운 순으로 반환
  // POST /api/admin/schedules        → 관리자 전용 신규 일정 등록
  //
  // region 매칭 규칙:
  //   - region 미지정 시 "전국" 일정 + 모든 지역 일정 모두 반환
  //   - region 지정 시 "전국" + 해당 지역 일정 반환 (시도별 토론회 등)
  app.get("/api/schedules", async (req, res) => {
    try {
      const region = typeof req.query.region === "string" ? req.query.region.trim() : "";
      const now = new Date();

      const baseQuery = db
        .select({
          id: electionSchedules.id,
          title: electionSchedules.title,
          eventDate: electionSchedules.eventDate,
          description: electionSchedules.description,
          region: electionSchedules.region,
        })
        .from(electionSchedules);

      const rows = region
        ? await baseQuery
            .where(
              and(
                gte(electionSchedules.eventDate, now),
                or(eq(electionSchedules.region, region), eq(electionSchedules.region, "전국"))
              )
            )
            .orderBy(asc(electionSchedules.eventDate))
        : await baseQuery
            .where(gte(electionSchedules.eventDate, now))
            .orderBy(asc(electionSchedules.eventDate));

      res.json(rows);
    } catch (error: any) {
      console.error("[schedules] error:", error);
      res.status(500).json({ error: error.message ?? "일정 조회 실패" });
    }
  });

  app.post("/api/admin/schedules", requireAdmin, async (req, res) => {
    try {
      const parsed = insertElectionScheduleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "유효하지 않은 일정 데이터",
          issues: parsed.error.issues,
        });
      }
      const [created] = await db
        .insert(electionSchedules)
        .values({
          title: parsed.data.title,
          eventDate: parsed.data.eventDate,
          description: parsed.data.description ?? null,
          region: parsed.data.region ?? "전국",
        })
        .returning();
      res.status(201).json(created);
    } catch (error: any) {
      console.error("[admin/schedules] error:", error);
      res.status(500).json({ error: error.message ?? "일정 등록 실패" });
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

  // ===== 사용자 차단 (UGC 모더레이션 — App Store 1.2) =====
  // 차단하면 해당 작성자의 글/댓글이 피드에서 숨겨진다. 익명 작성자도 글/댓글 id로 차단 가능.
  app.post("/api/community/block", requireAuth, async (req, res) => {
    try {
      const result = insertBlockSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "차단 대상을 지정하세요" });
      }
      const blockerId = req.session.userId!;
      let blockedId = result.data.blockedId;
      if (!blockedId) {
        blockedId = await storage.resolveAuthorId({ postId: result.data.postId, commentId: result.data.commentId });
      }
      if (!blockedId) {
        return res.status(404).json({ error: "대상을 찾을 수 없습니다" });
      }
      if (blockedId === blockerId) {
        return res.status(400).json({ error: "자기 자신은 차단할 수 없습니다" });
      }
      await storage.blockUser(blockerId, blockedId);
      res.json({ success: true, message: "차단되었습니다. 이 사용자의 글과 댓글이 더 이상 보이지 않습니다." });
    } catch (error) {
      console.error("Block error:", error);
      res.status(500).json({ error: "차단 처리 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/community/unblock", requireAuth, async (req, res) => {
    try {
      const blockedId = (req.body?.blockedId as string | undefined)?.trim();
      if (!blockedId) return res.status(400).json({ error: "해제할 대상을 지정하세요" });
      await storage.unblockUser(req.session.userId!, blockedId);
      res.json({ success: true, message: "차단이 해제되었습니다" });
    } catch (error) {
      console.error("Unblock error:", error);
      res.status(500).json({ error: "차단 해제 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/community/blocked", requireAuth, async (req, res) => {
    try {
      const ids = await storage.getBlockedIds(req.session.userId!);
      res.json({ blockedIds: ids });
    } catch (error) {
      console.error("Blocked list error:", error);
      res.status(500).json({ error: "차단 목록 조회 중 오류가 발생했습니다" });
    }
  });

  // ===== 푸시 알림 (APNs) =====
  // 기기 토큰 등록 — 비로그인(익명)도 허용. 로그인 시 actor id와 연결.
  app.post("/api/push/register", async (req, res) => {
    try {
      const token = (req.body?.token as string | undefined)?.trim();
      const platform = ((req.body?.platform as string | undefined) || "ios").trim();
      if (!token || token.length < 32 || token.length > 400) {
        return res.status(400).json({ error: "유효하지 않은 토큰" });
      }
      await storage.upsertDeviceToken(token, platform, peekActorId(req));
      res.json({ success: true });
    } catch (error) {
      console.error("Push register error:", error);
      res.status(500).json({ error: "토큰 등록 중 오류" });
    }
  });

  app.post("/api/push/unregister", async (req, res) => {
    try {
      const token = (req.body?.token as string | undefined)?.trim();
      if (token) await storage.removeDeviceToken(token);
      res.json({ success: true });
    } catch (error) {
      console.error("Push unregister error:", error);
      res.status(500).json({ error: "토큰 해제 중 오류" });
    }
  });

  // 관리자 수동 발송(테스트/공지) — ADMIN_USER_IDS만.
  app.post("/api/push/send", requireAdmin, async (req, res) => {
    try {
      if (!isApnsConfigured()) {
        return res.status(503).json({ error: "APNs가 설정되지 않았습니다(APNS_* 환경변수)." });
      }
      const title = (req.body?.title as string | undefined)?.trim();
      const body = (req.body?.body as string | undefined)?.trim();
      const link = (req.body?.link as string | undefined)?.trim() || undefined;
      if (!title || !body) {
        return res.status(400).json({ error: "title과 body가 필요합니다" });
      }
      const rows = await storage.getAllDeviceTokens("ios");
      const result = await sendPush(rows.map((r) => r.token), { title, body, link });
      // 무효 토큰 정리
      for (const t of result.invalidTokens) {
        await storage.removeDeviceToken(t).catch(() => {});
      }
      res.json({ success: true, ...result, total: rows.length });
    } catch (error) {
      console.error("Push send error:", error);
      res.status(500).json({ error: "발송 중 오류" });
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

  // 예비후보자 사진 사전 로드 (2초 후 백그라운드)
  setTimeout(() => {
    const candidateNames = [
      "오세훈", "정원오", "박형준", "전재수", "주호영", "김부겸",
      "유정복", "박찬대", "강기정", "이정현", "이장우", "허태정",
      "김두겸", "김상욱", "최민호", "이춘희", "추미애", "양향자",
      "김영환", "노영민", "김태흠", "박수현", "김관영", "정운천",
      "김영록", "이철우", "오중기", "박완수", "김경수", "오영훈",
      "허향진", "김진태", "우상호",
    ];
    preFetchPhotos(candidateNames).catch(() => {});
  }, 2000);

  // 뉴스 캐시 백그라운드 워밍 — 첫 법률/뉴스 탭 진입 시 RSS 12개 동기 스크랩으로
  // 수 초 지연되던 것을 부팅 직후 미리 채워 제거. 실패해도 요청 시 폴백됨.
  setTimeout(async () => {
    try {
      if (!newsCache || Date.now() - newsCache.cachedAt >= NEWS_CACHE_TTL) {
        const result = await fetchKoreanPoliticsNews();
        newsCache = { ...result, cachedAt: Date.now() };
        console.log(`[startup] 뉴스 캐시 워밍 완료 (${result.items.length}건)`);
      }
    } catch (err: any) {
      console.warn("[startup] 뉴스 캐시 워밍 실패 (요청 시 재시도):", err?.message);
    }
  }, 6000);

  // ===== 서버 시작 후 백그라운드 사전 로드 (표결 캐시 구축) =====
  // 표결 15만+건이 이미 DB(assembly_votes)에 있으므로 외부 국회 API를 대량 호출하지
  // 않고 DB에서 한 번에 읽어 billVotesCache + legislatorVotesIndex 를 메모리에 시드한다.
  // (DB가 비었을 때만 기존 외부 API 경로로 폴백 — 부팅 직후 네트워크/CPU 점유 제거)
  setTimeout(async () => {
    if (prefetchProgress.running) return;
    prefetchProgress.running = true;
    const t0 = Date.now();
    console.log("[startup] DB 기반 표결 사전 로드 시작...");
    try {
      const [{ c: voteCount }] = await db
        .select({ c: dsql<number>`count(*)::int` })
        .from(assemblyVotes);

      if (voteCount > 0) {
        // 단일 조인 쿼리로 전체 표결 + 법안명 로드 → 메모리 그룹핑
        const rows = await db
          .select({
            billId: assemblyVotes.billId,
            legislatorId: assemblyVotes.legislatorId,
            legislatorName: assemblyVotes.legislatorName,
            party: assemblyVotes.party,
            voteResult: assemblyVotes.voteResult,
            billName: assemblyBills.billName,
          })
          .from(assemblyVotes)
          .leftJoin(assemblyBills, eq(assemblyVotes.billId, assemblyBills.billId));

        const grouped = new Map<string, { billName: string; votes: MemberVote[] }>();
        for (const r of rows) {
          let g = grouped.get(r.billId);
          if (!g) { g = { billName: r.billName ?? "", votes: [] }; grouped.set(r.billId, g); }
          g.votes.push({
            legislatorId: r.legislatorId,
            legislatorName: r.legislatorName,
            party: r.party ?? "",
            voteResult: r.voteResult,
          });
        }
        const now = Date.now();
        for (const [billId, g] of grouped) {
          billVotesCache.set(billId, { votes: g.votes, cachedAt: now });
          updateLegislatorVotesIndex(billId, g.billName, g.votes);
        }
        prefetchProgress.total = grouped.size;
        prefetchProgress.done = grouped.size;
        prefetchProgress.running = false;
        prefetchProgress.completedAt = Date.now();
        console.log(
          `[startup] DB 시드 완료: 법안 ${grouped.size}건 / 표결 ${rows.length}건 / 의원 ${legislatorVotesIndex.size}명 (${Date.now() - t0}ms)`,
        );
        return;
      }

      // ── DB가 비었을 때만 기존 외부 API 폴백 ──
      console.log("[startup] DB 표결 0건 → 외부 API 폴백 로드");
      if (!enactedBillsCache) {
        const apiRows = await fetchEnactedBillsFromApi(30);
        enactedBillsCache = { data: apiRows, fetchedAt: Date.now() };
      }
      const allBills = enactedBillsCache.data;
      const billsToFetch = allBills.filter((b: any) => {
        const bid = b.BILL_ID || b.billId;
        return bid && !billVotesCache.has(bid);
      });
      prefetchProgress.total = allBills.length;
      prefetchProgress.done = allBills.length - billsToFetch.length;
      const BATCH = 6;
      for (let i = 0; i < billsToFetch.length; i += BATCH) {
        await Promise.all(
          billsToFetch.slice(i, i + BATCH).map(async (b: any) => {
            const billId = b.BILL_ID || b.billId;
            if (!billId || billVotesCache.has(billId)) { prefetchProgress.done++; return; }
            try {
              const result = await fetchBillMemberVotes(billId);
              if (result.votes.length === 0) {
                await db.update(assemblyBills).set({ syncedAt: new Date() }).where(eq(assemblyBills.billId, billId)).catch(() => {});
                billVotesCache.set(billId, { votes: [], cachedAt: Date.now() });
                prefetchProgress.done++;
                return;
              }
              billVotesCache.set(billId, { votes: result.votes, cachedAt: Date.now() });
              updateLegislatorVotesIndex(billId, result.billName, result.votes);
            } catch {}
            prefetchProgress.done++;
          })
        );
      }
      prefetchProgress.running = false;
      prefetchProgress.completedAt = Date.now();
      console.log(`[startup] 외부 API 폴백 완료 (${billVotesCache.size}개 법안 캐시)`);
    } catch (err: any) {
      prefetchProgress.running = false;
      console.error("[startup] 표결 사전 로드 오류:", err.message);
    }
  }, 4000);

  // ===== 여론조사 API =====
  // 크롤링 실행 (백그라운드)
  app.post("/api/polls/crawl", syncGuard, async (_req, res) => {
    res.json({ ok: true, message: "nesdc 여론조사 크롤링 시작" });
    crawlNesdcPolls()
      .then(r => console.log(`[polls/crawl] 완료: ${r.saved}건 저장`))
      .catch(e => console.error("[polls/crawl] 실패:", e.message));
  });

  // 지역별 최신 여론조사 조회
  app.get("/api/polls", async (req, res) => {
    try {
      // 공직선거법 §108 — 선거일 6일 전부터 투표 마감까지 여론조사 결과 공표 금지
      if (isPollPublicationBlackout()) {
        return res.status(451).json({
          error: "공직선거법 제108조에 따라 여론조사 결과는 선거일 6일 전부터 투표 마감 시각까지 공표할 수 없습니다.",
          blackout: true,
        });
      }
      const regionCode = (req.query.regionCode as string) || "";
      const rows = await getLatestPolls(regionCode);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ===== 선거 API =====
  app.post("/api/admin/sync-nec", syncGuard, async (_req, res) => {
    res.json({ success: true, message: "선관위 동기화 백그라운드 시작. 서버 로그에서 진행상황 확인" });
    import("./nec-sync")
      .then(m => m.syncElectionCandidates())
      .then(() => console.log("[sync-nec] 완료"))
      .catch(e => console.error("[sync-nec] 실패:", e.message));
  });

  // 선관위 공식사진 동기화 (5/21 후보자 등록 마감 이후 실행)
  app.post("/api/admin/sync-candidate-photos", syncGuard, async (_req, res) => {
    res.json({ success: true, message: "선관위 공식사진 동기화 백그라운드 시작. 서버 로그에서 진행상황 확인" });
    import("./nec-sync")
      .then(m => m.syncCandidatePhotos())
      .then(r => console.log("[sync-candidate-photos] 완료:", r))
      .catch(e => console.error("[sync-candidate-photos] 실패:", e.message));
  });

  // 5대 공약 본문(goalCont/methCont/distCont/deptCont) 보강
  app.post("/api/admin/enrich-pledges", syncGuard, async (req, res) => {
    const force = req.query.force === "1" || req.body?.force === true;
    res.json({ success: true, message: `공약 본문 보강 백그라운드 시작 (force=${force})` });
    import("./nec-sync")
      .then((m) => m.enrichCandidatePledges({ force }))
      .then((r) => console.log("[enrich-pledges] 완료:", r))
      .catch((e) => console.error("[enrich-pledges] 실패:", e.message));
  });

  // 선관위 API 테스트 (개발용)
  app.get("/api/admin/test-nec", syncGuard, async (req, res) => {
    try {
      const apiKey = process.env.DATA_GO_KR_API_KEY;
      if (!apiKey) return res.status(503).json({ error: "DATA_GO_KR_API_KEY 없음" });
      const sgTypecode = (req.query.type as string) || "3";
      const axios2 = (await import("axios")).default;

      // 두 가지 엔드포인트 시도
      const endpoints = [
        { name: "PofelcNationalCandidateService/getPreCandidateList", base: "http://apis.data.go.kr/9760000/PofelcNationalCandidateService", path: "getPreCandidateList" },
        { name: "UCandidateInfoInqireService/getPreliminayCandidateList", base: "http://apis.data.go.kr/9760000/UCandidateInfoInqireService", path: "getPreliminayCandidateList" },
      ];

      const results: any[] = [];
      for (const ep of endpoints) {
        try {
          const r = await axios2.get(`${ep.base}/${ep.path}`, {
            params: { serviceKey: apiKey, pageNo: "1", numOfRows: "5", sgId: "20260604", sgTypecode, resultType: "json" },
            timeout: 10000,
          });
          results.push({ endpoint: ep.name, status: r.status, data: JSON.stringify(r.data).slice(0, 500) });
        } catch (e: any) {
          results.push({ endpoint: ep.name, error: e.message, response: e.response?.data ? JSON.stringify(e.response.data).slice(0, 300) : undefined });
        }
      }
      res.json({ results });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 선거구 목록
  app.get("/api/election/all", async (_req, res) => {
    try {
      const rows = await db.select().from(electionCandidates);
      // 후보자 등록 마감 후에는 예비후보 제외 — 정식후보자만 노출.
      const candidates = isAfterCandidateRegistration()
        ? rows.filter((c) => c.status !== "예비후보")
        : rows;
      res.json(candidates);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 국회의원 재보궐선거 후보 전용 — 선거구별 그룹핑은 클라이언트에서.
  app.get("/api/election/assembly", async (_req, res) => {
    try {
      const rows = await db
        .select()
        .from(electionCandidates)
        .where(eq(electionCandidates.electionType, "국회의원"));
      
      console.log(`[assembly] DB 조회 결과: ${rows.length}명`);

      const proxyPhoto = (raw: string | null | undefined) =>
        raw && /^https?:\/\/info\.nec\.go\.kr\//.test(raw)
          ? `/api/photo/nec?url=${encodeURIComponent(raw)}`
          : raw || null;
      const PARTY_ORDER = ["민주당", "국민의힘", "조국혁신당", "개혁신당", "진보당"];
      const partyRank = (p: string) => {
        const i = PARTY_ORDER.findIndex((x) => (p || "").includes(x));
        return i < 0 ? 99 : i;
      };
      const payload = rows
        .filter((r) => !["등록무효", "사퇴", "사망", "등록거부"].includes(r.candidateStatus || ""))
        .map((r) => ({
          id: r.id,
          name: r.name,
          party: r.party || "무소속",
          candidateStatus: r.candidateStatus || r.status || "등록",
          regionCode: r.sdName,
          sdName: r.sdName,
          // 국회의원은 sggName(예: 북구갑)이 정식 선거구명 — districtName(wiwName)보다 우선.
          districtName: r.sggName || r.districtName,
          electionType: "assembly",
          photo: proxyPhoto(r.photo),
          job: r.job || null,
          career: r.career || null,
          career1: r.career1 || null,
          career2: r.career2 || null,
          edu: r.edu || null,
          age: r.age || null,
          gender: r.gender || null,
          birthday: r.birthday || null,
          pledges: Array.isArray(r.pledges) ? r.pledges : [],
          promises: Array.isArray(r.pledges) ? r.pledges : [],
          propertyAmount: r.propertyAmount || null,
          militaryService: r.militaryService || null,
          taxPaid: r.taxPaid || null,
          taxArrears: r.taxArrears || null,
          candidacyHistory: r.candidacyHistory || null,
          criminal: r.criminal || null,
          criminalRecords: Array.isArray(r.criminalRecords) ? r.criminalRecords : [],
        }))
        .sort((a, b) => {
          const d = (a.districtName || "").localeCompare(b.districtName || "");
          return d !== 0 ? d : partyRank(a.party) - partyRank(b.party);
        });

      // DB에 데이터가 있으면 바로 반환
      if (payload.length > 0) {
        return res.json(payload);
      }

      // DB가 비어있으면 NEC API 폴백 시도
      console.log("[assembly] DB 비어있음 → NEC API 폴백 시도");
      const apiKey = process.env.DATA_GO_KR_API_KEY;
      if (!apiKey) {
        console.warn("[assembly] DATA_GO_KR_API_KEY 없음 → 빈 배열 반환");
        return res.json([]);
      }

      try {
        const axios2 = (await import("axios")).default;
        // 재보궐 선거 sgId: 20260603, sgTypecode: 2 (국회의원)
        const sgId = "20260603";
        const r = await axios2.get(
          "https://apis.data.go.kr/9760000/PofelcddInfoInqireService/getPofelcddRegistSttusInfoInqire",
          {
            params: { serviceKey: apiKey, pageNo: "1", numOfRows: "200", sgId, sgTypecode: "2", resultType: "json" },
            timeout: 12000,
          }
        );
        const body = r.data?.response?.body ?? {};
        const rawItems = body?.items?.item ?? [];
        const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
        console.log(`[assembly] NEC API 폴백 결과: ${items.length}건`);

        const fallbackPayload = items.map((item: any) => ({
          id: item.huboid || `${item.sgId}_${item.name}`,
          name: item.name,
          party: item.jdName || "무소속",
          candidateStatus: item.status || "등록",
          regionCode: item.sdName,
          sdName: item.sdName,
          districtName: item.sggName || item.wiwName || item.sdName,
          electionType: "assembly",
          photo: proxyPhoto(item.jpgLink || item.photo || null),
          job: item.job || null,
          career: null, career1: null, career2: null, edu: null,
          age: item.age || null, gender: item.gender || null, birthday: item.birthday || null,
          pledges: [], promises: [],
          propertyAmount: null, militaryService: null, taxPaid: null, taxArrears: null,
          candidacyHistory: null, criminal: null, criminalRecords: [],
        })).sort((a: any, b: any) => {
          const d = (a.districtName || "").localeCompare(b.districtName || "");
          return d !== 0 ? d : partyRank(a.party) - partyRank(b.party);
        });

        return res.json(fallbackPayload);
      } catch (necErr: any) {
        console.error("[assembly] NEC API 폴백 실패:", necErr.message);
        return res.json([]); // 빈 배열 반환 (에러 대신)
      }
    } catch (err: any) {
      console.error("[assembly] DB 조회 오류:", err.message);
      res.status(500).json({ error: err.message });
    }
  });


  app.get("/api/election/districts", async (req, res) => {
    try {
      const { regionCode } = req.query as { regionCode: string };
      if (!regionCode) return res.status(400).json({ error: "regionCode 필요" });

      const districts = await db
        .selectDistinct({ districtName: electionCandidates.districtName })
        .from(electionCandidates)
        .where(eq(electionCandidates.regionCode, regionCode));

      res.json(districts.map(d => d.districtName).sort());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 후보자 목록 (실시간 선관위 API 조회)
  app.get("/api/election/candidates", async (req, res) => {
    try {
      const { regionCode, electionType } = req.query as Record<string, string>;
      if (!regionCode || !electionType) {
        return res.status(400).json({ error: "regionCode, electionType 필요" });
      }

      // 1. Strict Region Name Mapping (sdName)
      const REGION_MAP: Record<string, string> = {
        "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시",
        "인천": "인천광역시", "광주": "광주광역시", "대전": "대전광역시",
        "울산": "울산광역시", "세종": "세종특별자치시", "경기": "경기도",
        "강원": "강원특별자치도", "충북": "충청북도", "충남": "충청남도",
        "전북": "전북특별자치도", "전남": "전라남도", "경북": "경상북도",
        "경남": "경상남도", "제주": "제주특별자치도",
        // 기존 코드 호환
        "11": "서울특별시", "26": "부산광역시", "27": "대구광역시", "28": "인천광역시",
        "29": "광주광역시", "30": "대전광역시", "31": "울산광역시", "36": "세종특별자치시",
        "41": "경기도", "42": "강원특별자치도", "43": "충청북도", "44": "충청남도",
        "45": "전북특별자치도", "46": "전라남도", "47": "경상북도", "48": "경상남도",
        "50": "제주특별자치도", "51": "강원특별자치도"
      };

      let actualSdName = regionCode;
      let targetDistrictName: string | null = null;
      if (regionCode.includes("_")) {
        const parts = regionCode.split("_");
        actualSdName = REGION_MAP[parts[0]] || parts[0];
        targetDistrictName = parts.slice(1).join("_");
      } else {
        actualSdName = REGION_MAP[regionCode] || regionCode;
      }
      const sdName = actualSdName;

      // 2. Verify Election ID & Type
      const sgId = "20260603"; // 2026 지방선거
      let sgTypecode = "3"; // 기본 시·도지사선거
      if (electionType === "assembly" || electionType === "national-assembly") sgTypecode = "2";
      if (electionType === "mayor") sgTypecode = "3";
      if (electionType === "district-head" || electionType === "district") sgTypecode = "4";
      if (electionType === "metro-council") sgTypecode = "5";
      if (electionType === "district-council" || electionType === "local-council") sgTypecode = "6";
      if (electionType === "superintendent" || electionType === "edu") sgTypecode = "11";

      // DB electionType 한글 라벨 매핑
      const ELECTION_TYPE_LABELS: Record<string, string> = {
        "2": "국회의원",
        "3": "시도지사",
        "4": "구시군의장",
        "5": "시도의원",
        "6": "구시군의원",
        "11": "교육감",
      };
      const typeLabel = ELECTION_TYPE_LABELS[sgTypecode] || "시도지사";

      // NEC HTTP 사진 URL → 서버 프록시 경유 (mixed-content 차단 회피)
      const proxyPhoto = (raw: string | null | undefined) => {
        if (raw && /^https?:\/\/info\.nec\.go\.kr\//.test(raw)) {
          return `/api/photo/nec?url=${encodeURIComponent(raw)}`;
        }
        return raw || null;
      };

      // ───────── DB 우선 경로 ─────────
      // 후보자 등록 데이터는 election_candidates 테이블이 정본(Deep Sync로 적재).
      // 외부 NEC API를 매 요청마다 2번 직렬 호출(최대 30s)하던 것을 제거하고
      // DB에서 즉시 응답 + 10분 메모리 캐시. (region_code+election_type 인덱스 사용)
      const cacheKey = `${sdName}:${targetDistrictName || 'all'}:${sgTypecode}`;
      const cached = electionCandidateCache.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt < ELECTION_CANDIDATE_TTL) {
        return res.json(cached.data);
      }

      let dbRows = await db
        .select()
        .from(electionCandidates)
        .where(
          and(
            eq(electionCandidates.sdName, sdName),
            eq(electionCandidates.electionType, typeLabel)
          )
        );
        
      console.log(`[assembly-debug] sdName: ${sdName}, typeLabel: ${typeLabel}, dbRows length before filter: ${dbRows.length}`);
        
      if (targetDistrictName) {
        dbRows = dbRows.filter(r => 
          r.districtName === targetDistrictName || 
          r.sggName?.includes(targetDistrictName) || 
          r.wiwName === targetDistrictName
        );
        console.log(`[assembly-debug] targetDistrictName: ${targetDistrictName}, dbRows length after filter: ${dbRows.length}`);
      }

      if (dbRows.length > 0) {
        // 후보자 등록 마감 후에는 예비후보 레코드 제외 — 정식후보자만 노출.
        const sourceRows = isAfterCandidateRegistration()
          ? dbRows.filter((row) => row.status !== "예비후보")
          : dbRows;
        const payload = sourceRows.map((row) => ({
          id: row.id,
          name: row.name,
          party: row.party || "무소속",
          candidateStatus: row.candidateStatus || row.status || "등록",
          regionCode: sdName,
          electionType,
          districtName: row.districtName || row.sggName || sdName,
          photo: proxyPhoto(row.photo),
          job: row.job || null,
          career: row.career || null,
          career1: row.career1 || null,
          career2: row.career2 || null,
          edu: row.edu || null,
          age: row.age || null,
          gender: row.gender || null,
          birthday: row.birthday || null,
          pledges: Array.isArray(row.pledges) ? row.pledges : [],
          promises: Array.isArray(row.pledges) ? row.pledges : [],
          // 검증정보 (선관위 CSV import) — null이면 클라이언트에서 "정보 없음" 처리
          propertyAmount: row.propertyAmount || null,
          militaryService: row.militaryService || null,
          taxPaid: row.taxPaid || null,
          taxArrears: row.taxArrears || null,
          candidacyHistory: row.candidacyHistory || null,
          criminal: row.criminal || null,
          criminalRecords: Array.isArray(row.criminalRecords) ? row.criminalRecords : [],
          supportCount: 0,
          myVote: false,
        }));
        electionCandidateCache.set(cacheKey, { data: payload, cachedAt: Date.now() });
        return res.json(payload);
      }

      // ───────── DB 비어있을 때만 외부 NEC API 폴백 ─────────
      const apiKey = process.env.DATA_GO_KR_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: "DATA_GO_KR_API_KEY 없음" });
      }

      const axios2 = (await import("axios")).default;
      const params = {
        serviceKey: apiKey,
        pageNo: "1",
        numOfRows: "200",
        sgId,
        sgTypecode,
        sdName,
        resultType: "json"
      };

      // 1) 정식 후보자 API
      const candidateUrl = "https://apis.data.go.kr/9760000/PofelcddInfoInqireService/getPofelcddRegistSttusInfoInqire";
      // 2) 예비 후보자 API
      const preCandidateUrl = "https://apis.data.go.kr/9760000/PreCandidateRegSttusInfoInqireService/getPreCandidateRegSttusInfoInqire";

      let items: any[] = [];

      // 정식·예비 후보 API는 서로 독립 → 직렬(최대 30s) 대신 병렬(최대 15s)로 호출.
      // 마감 이후에는 예비후보를 조회하지 않음.
      const registrationClosed = isAfterCandidateRegistration();
      const promises: Promise<any>[] = [
        axios2.get(candidateUrl, { params, timeout: 15000 })
      ];
      if (!registrationClosed) {
        promises.push(axios2.get(preCandidateUrl, { params, timeout: 15000 }));
      }

      const results = await Promise.allSettled(promises);
      const mainRes = results[0];
      const preRes = !registrationClosed ? results[1] : null;

      if (mainRes.status === "fulfilled") {
        const body = mainRes.value.data?.response?.body ?? {};
        const rawItems = body?.items?.item ?? [];
        const candidateItems = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
        items = [...items, ...candidateItems.map((item: any) => ({ ...item, _isPre: false }))];
        console.log(`[NEC API] 정식후보자 ${candidateItems.length}건 수신`);
      } else {
        console.error("[NEC API] 정식후보자 API 오류:", mainRes.reason?.message);
      }

      if (preRes && preRes.status === "fulfilled") {
        const body = preRes.value.data?.response?.body ?? {};
        const rawItems = body?.items?.item ?? [];
        const preCandidateItems = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
        console.log(`[NEC API] 예비후보자 ${preCandidateItems.length}건 수신`);

        // 정식 후보에 없는 예비후보만 추가
        for (const preItem of preCandidateItems) {
          if (!items.some(item => item.name === preItem.name)) {
            items.push({ ...preItem, _isPre: true });
          }
        }
      } else if (preRes) {
        console.error("[NEC API] 예비후보자 API 오류:", preRes.reason?.message);
      }

      // 프론트엔드 호환성을 위해 DB 모델 포맷으로 변환
      // DB에 enrich:pledges로 적재된 실 공약이 있으면 그것을 사용, 없으면 빈 배열
      const candidateNames = items.map((item: any) => item.name).filter(Boolean);
      
      // DB에서 실 공약 데이터 조회 (이미 enrich:pledges 스크립트로 적재됨)
      let dbCandidateMap: Record<string, any> = {};
      if (candidateNames.length > 0) {
        try {
          const dbRows = await db.select()
            .from(electionCandidates)
            .where(
              and(
                inArray(electionCandidates.name, candidateNames),
                ilike(electionCandidates.sdName, `%${sdName.replace(/(특별자치도|특별자치시|특별시|광역시|도)$/, '').trim() || sdName}%`)
              )
            );
          for (const row of dbRows) {
            dbCandidateMap[row.name] = row;
          }
        } catch {}
      }

      // 후보자 등록 마감 후에는 예비후보 API 결과 제외 — 정식후보자만 노출.
      const visibleItems = isAfterCandidateRegistration()
        ? items.filter((item: any) => !item._isPre)
        : items;

      const candidates = visibleItems.map((item: any) => {
        const dbRow = dbCandidateMap[item.name];
        // 실 공약: DB에서 가져온 pledges → 없으면 빈 배열 (mock 없음)
        const pledges = (dbRow?.pledges && Array.isArray(dbRow.pledges) && dbRow.pledges.length > 0)
          ? dbRow.pledges
          : [];

        const status = item._isPre ? "예비후보" : (item.status || item.regStatus || item.sttuscode || "등록");

        return {
          id: dbRow?.id || item.huboid || `${item.sgId}_${item.name}`,
          name: item.name,
          party: item.jdName || "무소속",
          candidateStatus: status,
          regionCode: sdName,
          electionType: electionType,
          districtName: item.sggName || item.wiwName || sdName,
          photo: (() => {
            const raw = dbRow?.photo || item.photo || item.jpgLink || null;
            // info.nec.go.kr는 HTTP URL → 브라우저 mixed-content 차단. 서버 프록시 경유.
            if (raw && /^https?:\/\/info\.nec\.go\.kr\//.test(raw)) {
              return `/api/photo/nec?url=${encodeURIComponent(raw)}`;
            }
            return raw;
          })(),
          job: dbRow?.job || item.job || null,
          career: dbRow?.career || null,
          career1: dbRow?.career1 || item.career1 || null,
          career2: dbRow?.career2 || item.career2 || null,
          edu: dbRow?.edu || item.edu || null,
          age: dbRow?.age || item.age || null,
          gender: dbRow?.gender || item.gender || null,
          birthday: dbRow?.birthday || item.birthday || null,
          // 검증정보 (선관위 CSV import). 외부 NEC API 폴백에는 없으므로 DB row에서만 채워짐.
          propertyAmount: dbRow?.propertyAmount || null,
          militaryService: dbRow?.militaryService || null,
          taxPaid: dbRow?.taxPaid || null,
          taxArrears: dbRow?.taxArrears || null,
          candidacyHistory: dbRow?.candidacyHistory || null,
          criminal: dbRow?.criminal || null,
          criminalRecords: Array.isArray(dbRow?.criminalRecords) ? dbRow.criminalRecords : [],
          pledges,
          promises: pledges,
          supportCount: 0,
          myVote: false
        };
      });

      electionCandidateCache.set(cacheKey, { data: candidates, cachedAt: Date.now() });
      res.json(candidates);
    } catch (e: any) {
      console.error("[CANDIDATES API ERROR]", e.message);
      if (e.response) {
        console.error("[NEC API Error Response]:", e.response.data);
      }
      res.status(500).json({ error: e.message || String(e) });
    }
  });


  // 지지율 투표
  app.post("/api/election/support-vote", requireAuth, async (req, res) => {
    try {
      const { candidateId, districtName } = req.body;
      const userId = req.session.userId!;

      const existing = await db
        .select()
        .from(candidateSupportVotes)
        .where(
          eq(candidateSupportVotes.userId, userId) &&
          eq(candidateSupportVotes.districtName, districtName)
        )
        .limit(1);

      if (existing.length > 0) {
        return res.status(409).json({ error: "이미 이 선거구에서 투표하셨어요" });
      }

      await db.insert(candidateSupportVotes).values({ candidateId, userId, districtName });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 발언·행보 목록
  app.get("/api/election/statements", async (req, res) => {
    try {
      const { regionCode, districtName } = req.query as Record<string, string>;

      const candidates = await db
        .select({ id: electionCandidates.id })
        .from(electionCandidates)
        .where(
          and(
            eq(electionCandidates.regionCode, regionCode),
            eq(electionCandidates.districtName, districtName)
          )
        );

      if (candidates.length === 0) return res.json([]);

      const candidateIds = candidates.map(c => c.id);
      const userId = req.session?.userId;

      const rows = await db
        .select()
        .from(candidateStatements)
        .where(inArray(candidateStatements.candidateId, candidateIds))
        .orderBy(desc(candidateStatements.occurredAt))
        .limit(200);

      const statementIds = rows.map(r => r.id);
      const factChecks = statementIds.length > 0
        ? await db.select().from(statementFactChecks).where(inArray(statementFactChecks.statementId, statementIds))
        : [];

      const result = rows.map(s => ({
        ...s,
        factChecks: factChecks.filter(f => f.statementId === s.id),
        myVerdict: userId ? factChecks.find(f => f.statementId === s.id && f.userId === userId)?.verdict : null,
        commentCount: 0,
      }));

      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 발언 팩트체크 투표
  app.post("/api/election/statements/:id/factcheck", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      let { verdict } = req.body;
      const userId: string = req.session.userId!;

      // Ensure verdict is a single string, not an array
      if (Array.isArray(verdict)) {
        verdict = verdict[0];
      }

      if (!["true", "false", "misleading"].includes(String(verdict))) {
        return res.status(400).json({ error: "유효하지 않은 verdict" });
      }

      const statementId = String(id);
      const verdictStr = String(verdict);

      await db
        .insert(statementFactChecks)
        .values([{
          statementId: statementId,
          userId: userId,
          verdict: verdictStr
        }])
        .onConflictDoUpdate({
          target: [statementFactChecks.userId, statementFactChecks.statementId],
          set: { verdict: verdictStr },
        });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });  // ===== 공약 별점 및 댓글 =====
  app.get("/api/candidates/:id/pledges/:pledgeId/ratings", async (req, res) => {
    try {
      const { id, pledgeId } = req.params;
      const { pledgeRatings } = await import("@shared/schema");
      const userId = req.session?.userId;

      const ratings = await db.select().from(pledgeRatings)
        .where(and(eq(pledgeRatings.candidateId, id), eq(pledgeRatings.pledgeId, pledgeId)));

      const avg = ratings.length > 0 ? ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length : 0;
      const myRating = userId ? ratings.find(r => r.userId === userId)?.rating : null;

      res.json({ average: avg, totalCount: ratings.length, myRating });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/candidates/:id/pledges/:pledgeId/ratings", requireAuth, async (req, res) => {
    try {
      const id = req.params.id as string;
      const pledgeId = req.params.pledgeId as string;
      const { rating } = req.body;
      const userId = req.session.userId!;

      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "별점은 1~5점 사이여야 합니다." });
      }

      const ratingValues: typeof pledgeRatings.$inferInsert = {
        candidateId: id,
        pledgeId,
        userId,
        rating,
      };
      await db.insert(pledgeRatings).values(ratingValues).onConflictDoUpdate({
        target: [pledgeRatings.candidateId, pledgeRatings.pledgeId, pledgeRatings.userId],
        set: { rating }
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/candidates/:id/pledges/:pledgeId/comments", async (req, res) => {
    try {
      const { id, pledgeId } = req.params;
      const { pledgeComments } = await import("@shared/schema");

      const comments = await db.select().from(pledgeComments)
        .where(and(eq(pledgeComments.candidateId, id), eq(pledgeComments.pledgeId, pledgeId)))
        .orderBy(desc(pledgeComments.createdAt));

      res.json(comments);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/candidates/:id/pledges/:pledgeId/comments", async (req, res) => {
    try {
      const id = req.params.id as string;
      const pledgeId = req.params.pledgeId as string;
      const { content } = req.body;
      const actorId = getActorId(req);


      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: "내용을 입력해주세요." });
      }

      await db.insert(pledgeComments).values({
        candidateId: id,
        pledgeId,
        userId: actorId,
        content: content.trim(),
        anonNickname: getOrCreateNickname(actorId)
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ===== 검색 히스토리 =====

  // GET /api/search-history — 최근 검색어 조회 (최대 10개)
  app.get("/api/search-history", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId ?? null;
      const sessionId = req.sessionID || (req.ip ?? "anon");

      let rows;
      if (userId) {
        rows = await db.select()
          .from(searchHistory)
          .where(eq(searchHistory.userId, userId))
          .orderBy(desc(searchHistory.createdAt))
          .limit(10);
      } else {
        rows = await db.select()
          .from(searchHistory)
          .where(eq(searchHistory.sessionId, sessionId))
          .orderBy(desc(searchHistory.createdAt))
          .limit(10);
      }

      // 중복 제거 (같은 query는 최신 1개만)
      const seen = new Set<string>();
      const unique = rows.filter(r => {
        if (seen.has(r.query)) return false;
        seen.add(r.query);
        return true;
      });

      res.json(unique.map(r => ({ id: r.id, query: r.query, createdAt: r.createdAt })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/search-history — 검색어 저장
  app.post("/api/search-history", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== "string" || query.trim().length === 0) {
        return res.status(400).json({ error: "검색어를 입력해주세요" });
      }
      const trimmed = query.trim().slice(0, 100);
      const userId = (req.session as any)?.userId ?? null;
      const sessionId = req.sessionID || (req.ip ?? "anon");

      await db.insert(searchHistory).values({
        userId,
        sessionId,
        query: trimmed,
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/search-history — 전체 삭제
  app.delete("/api/search-history", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId ?? null;
      const sessionId = req.sessionID || (req.ip ?? "anon");

      if (userId) {
        await db.delete(searchHistory).where(eq(searchHistory.userId, userId));
      } else {
        await db.delete(searchHistory).where(eq(searchHistory.sessionId, sessionId));
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/search-history/:id — 개별 삭제
  app.delete("/api/search-history/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "잘못된 ID" });
      await db.delete(searchHistory).where(eq(searchHistory.id, id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ===== 선거 후보자 실시간 지지율 =====

  // GET /api/election/support-rates/:regionCode — 지역별 후보자 지지율 집계
  app.get("/api/election/support-rates/:regionCode", async (req, res) => {
    try {
      // 공직선거법 §108 — 지지율 정보도 여론조사로 해석될 여지가 있어 차단
      if (isPollPublicationBlackout()) {
        return res.status(451).json({
          error: "공직선거법 제108조에 따라 선거일 6일 전부터 투표 마감까지 지지율을 공개할 수 없습니다.",
          blackout: true,
        });
      }
      const { regionCode } = req.params;

      // 해당 지역 후보자 목록
      const candidates = await db.select()
        .from(electionCandidates)
        .where(eq(electionCandidates.regionCode, regionCode));

      if (candidates.length === 0) {
        return res.json({ rates: [], total: 0 });
      }

      const candidateIds = candidates.map(c => c.id);

      // 후보자별 지지 투표 수 집계
      const voteCounts = await db.select({
        candidateId: candidateSupportVotes.candidateId,
        count: count(),
      })
        .from(candidateSupportVotes)
        .where(inArray(candidateSupportVotes.candidateId, candidateIds))
        .groupBy(candidateSupportVotes.candidateId);

      const countMap: Record<string, number> = {};
      for (const row of voteCounts) {
        countMap[row.candidateId] = Number(row.count);
      }

      const total = Object.values(countMap).reduce((a, b) => a + b, 0);

      const rates = candidates.map(c => ({
        candidateId: c.id,
        name: c.name,
        party: c.party,
        voteCount: countMap[c.id] ?? 0,
        rate: total > 0 ? Math.round(((countMap[c.id] ?? 0) / total) * 1000) / 10 : 0,
      }));

      // 지지율 높은 순 정렬
      rates.sort((a, b) => b.voteCount - a.voteCount);

      res.json({ rates, total });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/election/support-votes — 지지 투표 (1인 1표, 같은 선거구 기준)
  app.post("/api/election/support-votes", async (req, res) => {
    try {
      const { candidateId } = req.body;
      if (!candidateId) return res.status(400).json({ error: "후보자 ID가 필요합니다" });

      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ error: "로그인이 필요합니다" });

      // 후보자 정보 조회
      const [candidate] = await db.select()
        .from(electionCandidates)
        .where(eq(electionCandidates.id, candidateId))
        .limit(1);

      if (!candidate) return res.status(404).json({ error: "후보자를 찾을 수 없습니다" });

      // 이미 해당 선거구에 투표했는지 확인 (districtName 기준)
      const existing = await db.select()
        .from(candidateSupportVotes)
        .where(
          and(
            eq(candidateSupportVotes.userId, userId),
            eq(candidateSupportVotes.districtName, candidate.districtName),
          )
        )
        .limit(1);

      if (existing.length > 0) {
        if (existing[0].candidateId === candidateId) {
          // 같은 후보 → 취소
          await db.delete(candidateSupportVotes).where(eq(candidateSupportVotes.id, existing[0].id));
          return res.json({ success: true, action: "cancelled" });
        } else {
          // 다른 후보 → 변경
          await db.update(candidateSupportVotes)
            .set({ candidateId })
            .where(eq(candidateSupportVotes.id, existing[0].id));
          return res.json({ success: true, action: "changed" });
        }
      }

      await db.insert(candidateSupportVotes).values({
        candidateId,
        userId,
        districtName: candidate.districtName,
      });

      res.json({ success: true, action: "voted" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ===== 정치인 사진 배치 URL 조회 =====
  // GET /api/politician-photos/batch?names=홍준표,이재명,...&contexts={"김종훈":"국민의힘",...}
  app.get("/api/politician-photos/batch", async (req, res) => {
    const raw = req.query.names;
    if (!raw || typeof raw !== "string") return res.json({});
    const names = raw.split(",").map((n) => n.trim()).filter(Boolean).slice(0, 100);
    if (!names.length) return res.json({});

    // contexts: name → party/region 힌트 — 동명이인 disambiguation에 활용
    let contexts: Record<string, string> = {};
    if (req.query.contexts && typeof req.query.contexts === "string") {
      try { contexts = JSON.parse(req.query.contexts); } catch { /* 무시 */ }
    }

    const urls = await getBatchPhotoUrls(names, contexts);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.json(urls);
  });

  // 선관위 후보자 공식 사진 프록시 (info.nec.go.kr — HTTP URL이라 브라우저 mixed-content 차단됨)
  app.get("/api/photo/nec", async (req, res) => {
    const url = typeof req.query.url === "string" ? req.query.url.trim() : "";
    if (!url || !/^https?:\/\/info\.nec\.go\.kr\//.test(url)) return res.status(400).end();
    const result = await proxyImage(url);
    if (!result) return res.status(404).end();
    res.setHeader("Content-Type", result.contentType);
    // 선관위 후보 공식 사진은 후보 ID당 불변 → 30일 immutable.
    res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    return res.send(result.data);
  });

  // 국회의원 공식 사진 직접 프록시 (monaCd당 불변 → 30일 immutable)
  app.get("/api/photo/assembly/:monaCd", async (req, res) => {
    const { monaCd } = req.params;
    if (!/^[A-Z0-9a-z]+$/.test(monaCd)) return res.status(400).end();
    const url = `https://www.assembly.go.kr/static/portal/img/open_assm/${monaCd}.jpg`;
    const result = await proxyImage(url);
    if (!result) return res.status(404).end();
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    return res.send(result.data);
  });

  // ===== 정치인 사진 프록시 =====
  // GET /api/politician-photo?name=홍준표&monaCd=1234567 → 사진을 서버에서 프록시해 제공.
  // 동명이인 disambiguation: monaCd가 있으면 legislators에서 party를 조회해 검색 컨텍스트로 사용.
  // (이전 구현은 monaCd 자체를 context로 넘겨 "황희 M03AAA1234" 같은 무의미한 쿼리를 만들었음 →
  //  Naver가 그 쿼리에서 빈손이면 plain name으로 재시도 → 황희정승 같은 동명이인 인물이 찍힘.)
  app.get("/api/politician-photo", async (req, res) => {
    const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
    const monaCd = typeof req.query.monaCd === "string" ? req.query.monaCd.trim() : undefined;
    const contextParam = typeof req.query.context === "string" ? req.query.context.trim() : undefined;

    if (!name && !monaCd) return res.status(400).end();

    // context 우선순위: 직접 전달 > monaCd로 DB 조회 (정당+지역구 포함해 동명이인 구분)
    let context: string | undefined = contextParam;
    if (!context && monaCd) {
      try {
        const [row] = await db
          .select({ party: legislators.party, district: legislators.district })
          .from(legislators)
          .where(eq(legislators.monaCd, monaCd))
          .limit(1);
        if (row?.party) {
          const parts = [row.party, row.district, "국회의원"].filter(Boolean);
          context = parts.join(" ");
        }
      } catch {
        // ignore — context 없이도 진행 가능
      }
    }

    const photoUrl = await getPoliticianPhotoUrl(name, context);
    if (!photoUrl) return res.status(404).end();

    const result = await proxyImage(photoUrl);
    if (!result) return res.status(502).end();

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.send(result.data);
  });

  // ===== 오늘의 핫이슈 (데일리 폴) =====
  
  app.get("/api/daily-polls/today", async (req, res) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      let [poll] = await db
        .select()
        .from(dailyPolls)
        .where(eq(dailyPolls.date, today))
        .limit(1);
      
      if (!poll) {
        // 임시로 자동 생성 (실제로는 어드민이나 크론에서 생성)
        const [newPoll] = await db.insert(dailyPolls).values({
          date: today,
          title: "오늘의 투표: 지방선거에서 가장 중요한 공약 분야는?",
          description: "2026 지방선거를 앞두고 유권자들의 의견을 묻습니다.",
          options: [
            { id: "economy", label: "경제·일자리" },
            { id: "welfare", label: "복지·교육" },
            { id: "housing", label: "주거·교통" },
            { id: "safety", label: "안전·환경" },
          ],
        }).returning();
        poll = newPoll;
      }
      
      const actorId = getActorId(req);
      let userVote = null;
      const [vote] = await db
        .select()
        .from(dailyPollVotes)
        .where(and(eq(dailyPollVotes.pollId, poll.id), eq(dailyPollVotes.userId, actorId)))
        .limit(1);
      if (vote) userVote = vote.optionId;
      
      // 결과 집계
      const rawVotes = await db
        .select({
          optionId: dailyPollVotes.optionId,
          count: dsql<number>`count(*)::int`,
        })
        .from(dailyPollVotes)
        .where(eq(dailyPollVotes.pollId, poll.id))
        .groupBy(dailyPollVotes.optionId);
        
      const results: Record<string, number> = {};
      let totalVotes = 0;
      for (const rv of rawVotes) {
        results[rv.optionId] = rv.count;
        totalVotes += rv.count;
      }
      
      return res.json({ poll, userVote, results, totalVotes });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "서버 오류" });
    }
  });
  
  app.post("/api/daily-polls/:id/vote", async (req, res) => {
    const { optionId } = req.body;
    if (!optionId) return res.status(400).json({ error: "옵션을 선택해주세요." });

    const actorId = getActorId(req);
    const sessionUser = (req as any).user as { id: string } | undefined;

    try {
      await db.insert(dailyPollVotes).values({
        pollId: String(req.params.id),
        userId: actorId,
        optionId: String(optionId),
      });
      // EXP 보상은 로그인한 사용자만
      let reward = 0;
      if (sessionUser) {
        await db.update(users)
          .set({ exp: dsql`exp + 50` })
          .where(eq(users.id, sessionUser.id));
        reward = 50;
      }
      return res.json({ success: true, reward });
    } catch (e: any) {
      if (e.code === '23505') return res.status(400).json({ error: "이미 투표하셨습니다." });
      console.error(e);
      return res.status(500).json({ error: "서버 오류" });
    }
  });

  // ===== 출석 체크 (게이미피케이션) =====
  
  app.post("/api/users/attendance", requireAuth, async (req, res) => {
    const sessionUser = (req as any).user as { id: string } | undefined;
    if (!sessionUser) return res.status(401).json({ error: "로그인 필요" });
    
    try {
      const today = new Date().toISOString().split("T")[0];
      const [user] = await db.select().from(users).where(eq(users.id, sessionUser.id)).limit(1);
      
      if (!user) return res.status(404).json({ error: "유저를 찾을 수 없습니다." });
      if (user.lastAttendanceDate === today) {
        return res.json({ success: false, message: "이미 오늘 출석하셨습니다.", currentExp: user.exp, streak: user.attendanceStreak });
      }
      
      let newStreak = 1;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      
      if (user.lastAttendanceDate === yesterdayStr) {
        newStreak = user.attendanceStreak + 1;
      }
      
      const rewardExp = 100 + (newStreak > 1 ? 20 : 0); // 기본 100 + 연속 출석 20 추가
      
      await db.update(users)
        .set({ 
          lastAttendanceDate: today,
          attendanceStreak: newStreak,
          exp: dsql`exp + ${rewardExp}`
        })
        .where(eq(users.id, sessionUser.id));
        
      return res.json({ 
        success: true, 
        message: "출석 완료!", 
        rewardExp, 
        streak: newStreak,
        currentExp: user.exp + rewardExp 
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "서버 오류" });
    }
  });

  // ===== 공지사항 =====
  // 가장 최근 활성 공지사항 1건 반환 (모든 사용자)
  app.get("/api/announcements/active", async (req, res) => {
    try {
      const [row] = await db
        .select()
        .from(announcements)
        .where(
          and(
            eq(announcements.isActive, true),
            or(
              isNull(announcements.expiresAt),
              gt(announcements.expiresAt, new Date())
            )
          )
        )
        .orderBy(desc(announcements.createdAt))
        .limit(1);
      return res.json(row ?? null);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "서버 오류" });
    }
  });

  // 전체 공지사항 목록 (관리자)
  app.get("/api/announcements", requireAuth, async (req, res) => {
    const sessionUser = (req as any).user as { id: string } | undefined;
    if (!sessionUser) return res.status(401).json({ error: "로그인 필요" });
    const [admin] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, sessionUser.id)).limit(1);
    if (!admin?.isAdmin) return res.status(403).json({ error: "관리자만 접근 가능합니다" });

    try {
      const rows = await db
        .select()
        .from(announcements)
        .orderBy(desc(announcements.createdAt))
        .limit(50);
      return res.json(rows);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "서버 오류" });
    }
  });

  // 공지사항 작성 (관리자)
  app.post("/api/announcements", requireAuth, async (req, res) => {
    const sessionUser = (req as any).user as { id: string } | undefined;
    if (!sessionUser) return res.status(401).json({ error: "로그인 필요" });
    const [admin] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, sessionUser.id)).limit(1);
    if (!admin?.isAdmin) return res.status(403).json({ error: "관리자만 접근 가능합니다" });

    const parsed = insertAnnouncementSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });

    try {
      const [row] = await db
        .insert(announcements)
        .values({
          title: parsed.data.title,
          content: parsed.data.content,
          createdBy: sessionUser.id,
          expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
          isActive: true,
        })
        .returning();
      return res.status(201).json(row);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "서버 오류" });
    }
  });

  // 공지사항 비활성화/삭제 (관리자)
  app.delete("/api/announcements/:id", requireAuth, async (req, res) => {
    const sessionUser = (req as any).user as { id: string } | undefined;
    if (!sessionUser) return res.status(401).json({ error: "로그인 필요" });
    const [admin] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, sessionUser.id)).limit(1);
    if (!admin?.isAdmin) return res.status(403).json({ error: "관리자만 접근 가능합니다" });

    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId);
    if (isNaN(id)) return res.status(400).json({ error: "잘못된 ID" });

    try {
      await db.update(announcements).set({ isActive: false }).where(eq(announcements.id, id));
      return res.json({ ok: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "서버 오류" });
    }
  });

  return httpServer;
}
