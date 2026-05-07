/**
 * 최근 주목받는 의원 크롤러
 * 1. 국내 주요 언론사 RSS에서 의원 이름 언급 빈도를 분석 (오직 뉴스 기준)
 * 2. LLM(Gemini)을 활용해 동일 주제 뉴스 집중도에 따른 가산점(Topic Boost) 부여
 * 3. 뉴스 헤드라인을 바탕으로 주목받는 핵심 이유 텍스트 생성
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { db } from "./db";
import { legislators } from "@shared/schema";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// ===== 캐시 (30분) =====
interface TrendingMember {
  id: string;
  name: string;
  party: string;
  district: string;
  photo?: string;
  mentionCount: number;       // 뉴스 언급 횟수
  recentBills: number;        // (미사용) 하위 호환성 유지
  score: number;              // 종합 점수 (언급횟수 + AI가산점)
  reason: string;             // 주목 이유 요약 (AI 생성)
  newsHeadlines: string[];    // 관련 뉴스 제목들
  sourceUrl?: string;
}

let cache: { data: TrendingMember[]; cachedAt: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30분

// ===== RSS 피드 목록 (정치 섹션) =====
const RSS_FEEDS = [
  { url: "https://www.yna.co.kr/rss/politics.xml", source: "연합뉴스" },
  { url: "https://news.kbs.co.kr/rss/rss.do?cId=02", source: "KBS" },
  { url: "https://imnews.imbc.com/rss/politics.xml", source: "MBC" },
  { url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=02&plink=RSSREADER", source: "SBS" },
  { url: "https://news.jtbc.co.kr/rss/politics.xml", source: "JTBC" },
  { url: "https://www.ytn.co.kr/_pn/0101_rss.xml", source: "YTN" },
  { url: "https://www.hani.co.kr/rss/politics/", source: "한겨레" },
  { url: "https://www.khan.co.kr/rss/rssdata/politic_news.xml", source: "경향신문" },
  { url: "https://www.chosun.com/arc/outboundfeeds/rss/category/politics/?outputType=xml", source: "조선일보" },
  { url: "https://rss.donga.com/politics.xml", source: "동아일보" },
];

// ===== 의원 이름 추출용 정규식 =====
const MEMBER_TITLE_PATTERNS = [
  /([가-힣]{2,4})\s*(?:의원|국회의원|원내대표|원내총무|의장|부의장|대표|대표의원|정책위의장|수석부대표)/g,
  /([가-힣]{2,4})\s*(?:민주당|국민의힘|조국혁신당|개혁신당|진보당|무소속)\s*의원/g,
];

// 필터링할 일반 단어
const EXCLUDE_NAMES = new Set([
  "여당", "야당", "민주당", "국민의힘", "조국혁신당", "개혁신당", "무소속",
  "원내대표", "대표", "의장", "부의장", "위원장", "간사", "정책", "법안",
  "국회", "정치", "선거", "투표", "공약", "정당", "후보", "대통령", "총리",
  "장관", "차관", "비서", "참모", "보좌관",
]);

function extractText(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (val.__cdata) return String(val.__cdata);
  if (val["#text"]) return String(val["#text"]);
  return String(val);
}

/**
 * RSS에서 정치 뉴스 수집 및 의원 언급 횟수 집계
 */
async function crawlNewsForMemberMentions(): Promise<{
  mentions: Map<string, { count: number; headlines: string[] }>;
  totalArticles: number;
}> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    cdataPropName: "__cdata",
  });

  const mentions = new Map<string, { count: number; headlines: string[] }>();
  let totalArticles = 0;

  await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const res = await axios.get(feed.url, {
          timeout: 8000,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; KoreanVoteGuideBot/1.0)",
            "Accept-Language": "ko-KR,ko;q=0.9",
          },
        });

        const parsed = parser.parse(res.data);
        const rawItems = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
        const feedItems = Array.isArray(rawItems) ? rawItems : [rawItems];

        for (const item of feedItems.slice(0, 20)) {
          const title = extractText(item.title);
          const description = extractText(item.description || item.summary || "");
          const fullText = `${title} ${description}`;

          totalArticles++;

          // 의원 이름 추출
          for (const pattern of MEMBER_TITLE_PATTERNS) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(fullText)) !== null) {
              const name = match[1]?.trim();
              if (!name || EXCLUDE_NAMES.has(name) || name.length < 2) continue;

              const existing = mentions.get(name) || { count: 0, headlines: [] };
              existing.count++;
              if (title && !existing.headlines.includes(title) && existing.headlines.length < 5) {
                existing.headlines.push(title); // 최대 5개 헤드라인 수집
              }
              mentions.set(name, existing);
            }
          }
        }
        console.log(`[trending] ${feed.source}: ${feedItems.length}건 분석`);
      } catch (err: any) {
        console.error(`[trending] ${feed.source} 오류:`, err.message);
      }
    })
  );

  return { mentions, totalArticles };
}

/**
 * DB에서 의원 기본 정보 조회
 */
async function getMemberInfoFromDB(): Promise<Map<string, any>> {
  const memberMap = new Map<string, any>();
  try {
    const rows = await db.select().from(legislators);
    for (const row of rows) {
      if (row.name) {
        memberMap.set(row.name, row);
      }
    }
    console.log(`[trending] DB 의원 ${memberMap.size}명 로드`);
  } catch (err: any) {
    console.error("[trending] DB 조회 오류:", err.message);
  }
  return memberMap;
}

/**
 * AI(Gemini)를 활용한 의원별 헤드라인 주제 집중도 분석 및 이유 생성
 */
async function analyzeTrendingWithAI(members: any[]): Promise<any[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[trending] GEMINI_API_KEY가 없습니다. 기본 점수와 이유를 사용합니다.");
    return members.map(m => ({ ...m, topicBoost: 0, reason: "주요 뉴스에 다수 언급됨" }));
  }

  const googleAI = createGoogleGenerativeAI({ apiKey });

  const promptStr = `
당신은 한국 정치 뉴스를 분석하는 AI입니다.
아래는 최근 뉴스에서 언급된 국회의원들과 그들을 언급한 뉴스 기사의 헤드라인 목록입니다.

${members.map(m => `의원: ${m.name}\n헤드라인:\n${m.headlines.map((h: string) => `- ${h}`).join("\n")}`).join("\n\n")}

각 의원에 대해 다음을 분석하여 JSON 배열 형태로 반환해주세요. 반드시 마크다운(backticks 등) 없이 순수 JSON 배열만 반환해야 합니다.

1. name: 의원 이름
2. topicBoost: 의원의 헤드라인들이 "동일한 특정 이슈(사건/주제)"에 집중되어 있는지 평가하세요. 
   - 똑같은 주제의 뉴스로만 집중적으로 언급되었다면 1점에서 최대 5점 사이의 가산점(topicBoost)을 부여하세요. (집중도가 높고 중요한 이슈일수록 높은 점수)
   - 여러 가지 잡다한 주제로 분산되어 있다면 0점을 부여하세요.
3. reason: 이 의원이 왜 뉴스에 오르내리고 있는지 핵심 이유를 **20자 내외의 한국어**로 요약하세요. (예: "당대표 출마 공식 선언", "돈봉투 의혹 검찰 소환", "채상병 특검법 관련 주요 발언")

응답 예시 형식:
[
  { "name": "홍길동", "topicBoost": 4, "reason": "전당대회 당대표 출마 선언" }
]
`;

  try {
    const { text } = await generateText({
      model: googleAI("gemini-2.0-flash"),
      prompt: promptStr,
      maxRetries: 2,
    });

    let jsonStr = text.trim();
    if (jsonStr.startsWith("\`\`\`json")) {
      jsonStr = jsonStr.replace(/^\`\`\`json\n/, "").replace(/\n\`\`\`$/, "");
    }
    if (jsonStr.startsWith("\`\`\`")) {
      jsonStr = jsonStr.replace(/^\`\`\`\n?/, "").replace(/\n?\`\`\`$/, "");
    }

    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("[trending] AI 분석 오류:", error);
    return members.map(m => ({ ...m, topicBoost: 0, reason: "주요 뉴스에 다수 언급됨" }));
  }
}

/**
 * 최근 주목받는 의원 크롤링 메인 함수
 */
export async function crawlTrendingMembers(): Promise<TrendingMember[]> {
  console.log("[trending] 최근 주목받는 의원 크롤링 시작 (오직 뉴스 단일 기준)...");

  // 1. 뉴스 크롤링 및 의원 언급 집계
  const { mentions } = await crawlNewsForMemberMentions();

  // 2. DB에서 의원 기본 정보 조회
  const memberInfo = await getMemberInfoFromDB();

  // 3. 1차 필터링 및 정렬
  let candidates: any[] = [];
  for (const [name, mention] of mentions.entries()) {
    const dbInfo = memberInfo.get(name);
    // 실제 DB에 있는 의원만 포함, 최소 1회 이상 언급
    if (!dbInfo || mention.count < 1) continue;

    candidates.push({
      id: dbInfo.id || dbInfo.monaCode || name,
      name,
      party: dbInfo.party || "확인 중",
      district: dbInfo.district || "",
      photo: dbInfo.photoUrl || undefined,
      mentionCount: mention.count,
      recentBills: 0, // 사용하지 않음 (이전 버전 호환용)
      headlines: mention.headlines || [],
    });
  }

  // 언급 횟수 기준으로 내림차순 1차 정렬 (상위 20명만 AI 분석)
  candidates.sort((a, b) => b.mentionCount - a.mentionCount);
  const topCandidates = candidates.slice(0, 20);

  if (topCandidates.length === 0) return [];

  console.log(`[trending] AI 분석 시작 (상위 ${topCandidates.length}명)...`);
  // 4. AI 주제 집중도 분석 및 이유 생성
  const aiResults = await analyzeTrendingWithAI(topCandidates);
  const aiMap = new Map(aiResults.map((r: any) => [r.name, r]));

  // 5. 최종 점수 산정 및 결과 매핑
  const ranked: TrendingMember[] = topCandidates.map(c => {
    const ai = aiMap.get(c.name);
    const topicBoost = ai?.topicBoost || 0;
    // 언급 횟수(1점) + 집중도 가산점(0~5점)
    const score = c.mentionCount + topicBoost;
    const reason = ai?.reason || `${c.mentionCount}건 뉴스 언급`;

    return {
      ...c,
      score,
      reason,
      newsHeadlines: c.headlines,
    };
  });

  // 6. 최종 점수로 재정렬
  ranked.sort((a, b) => b.score - a.score);

  const top = ranked.slice(0, 7);
  console.log(`[trending] 완료: 총 ${candidates.length}명 중 상위 ${top.length}명`);
  top.forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.name} (${m.party}) - 언급 ${m.mentionCount}건, 점수 ${m.score}, 이유: ${m.reason}`);
  });

  return top;
}

/**
 * 캐시를 포함한 주목 의원 조회
 */
export async function getTrendingMembersWithCache(): Promise<TrendingMember[]> {
  const now = Date.now();

  if (cache && now - cache.cachedAt < CACHE_TTL) {
    console.log("[trending] 캐시 반환");
    return cache.data;
  }

  const data = await crawlTrendingMembers();

  // 빈 결과면 캐시 유지 (5분만)
  if (data.length === 0 && cache) {
    return cache.data;
  }

  cache = { data, cachedAt: now };
  return data;
}

/**
 * 캐시 초기화
 */
export function clearTrendingMembersCache() {
  cache = null;
}
