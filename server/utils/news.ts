/**
 * server/utils/news.ts — 정치인 최근 뉴스 수집기 (네이버 검색 API)
 *
 * AI 평가 파이프라인의 세 번째 데이터 소스(최근 뉴스 / 공개 발언)를 담당.
 * Open Assembly API에서 얻을 수 없는 “현재 시점의 발언·행보”를 보강한다.
 *
 * 보안:
 *   - politicianName 은 검색 query 로만 사용되며, HTTP 헤더에 들어가지 않는다.
 *   - 클라이언트 ID/SECRET 는 process.env 에서만 읽고 응답에 포함하지 않는다.
 *
 * 신뢰도:
 *   - 네이버가 반환하는 title/description 은 <b> 태그가 섞여 있으므로 stripHtml 로 정제.
 *   - HTML 엔티티(&quot; &amp; &lt; &gt; &#39;)도 함께 디코딩.
 *   - 발행일(pubDate)은 RFC 822 → ISO 8601 (yyyy-mm-dd) 로 정규화하여 LLM이 다루기 쉽게.
 */

import axios from "axios";

const NAVER_NEWS_ENDPOINT = "https://openapi.naver.com/v1/search/news.json";
const DEFAULT_DISPLAY = 10;        // 1~100 (Naver 제한)
const MAX_DISPLAY = 10;            // 본 파이프라인은 최대 10건만 LLM에 주입
const REQUEST_TIMEOUT_MS = 8000;

export interface RecentNewsItem {
  /** 정제된 기사 제목 (HTML 태그 / 엔티티 제거) */
  title: string;
  /** 정제된 요약/스니펫 */
  description: string;
  /** 원본 기사 URL (originallink 우선, 없으면 link) */
  link: string;
  /** ISO 8601 날짜 (yyyy-mm-dd). 파싱 실패 시 빈 문자열 */
  pubDate: string;
}

/** Naver Search API 원본 응답 구조 (필요한 필드만) */
interface NaverNewsApiItem {
  title: string;
  originallink?: string;
  link: string;
  description: string;
  pubDate: string; // RFC 822 (예: "Mon, 13 May 2026 10:30:00 +0900")
}

interface NaverNewsApiResponse {
  total: number;
  start: number;
  display: number;
  items: NaverNewsApiItem[];
}

// ─────────────────────────────────────────────
// 텍스트 정제 헬퍼
// ─────────────────────────────────────────────

export function stripHtml(input: string): string {
  if (!input) return "";
  return input
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** RFC 822 → "yyyy-mm-dd" (LLM 일관성용). 파싱 실패 시 "". */
function normalizeDate(rfc822: string): string {
  if (!rfc822) return "";
  const ts = Date.parse(rfc822);
  if (Number.isNaN(ts)) return "";
  return new Date(ts).toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────
// 공개 함수
// ─────────────────────────────────────────────

/**
 * 정치인 이름으로 네이버 뉴스 검색.
 *
 * @param politicianName 검색할 정치인 이름 (예: "이재명")
 * @param limit          최대 반환 건수 (기본 10, 상한 10)
 * @returns 정제된 뉴스 배열. 키 미설정·네트워크 오류 시 빈 배열 반환 (호출자 분기 단순화).
 *
 * 환경변수:
 *   - NAVER_SEARCH_CLIENT_ID
 *   - NAVER_SEARCH_CLIENT_SECRET
 */
export async function fetchRecentNews(
  politicianName: string,
  limit: number = DEFAULT_DISPLAY
): Promise<RecentNewsItem[]> {
  const name = (politicianName ?? "").trim();
  if (!name) return [];

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    process.stderr.write(
      "  ⚠ [news/fetchRecentNews] NAVER_CLIENT_ID/SECRET 미설정 — 빈 배열 반환\n"
    );
    return [];
  }

  const display = Math.min(Math.max(1, limit), MAX_DISPLAY);

  try {
    const { data } = await axios.get<NaverNewsApiResponse>(NAVER_NEWS_ENDPOINT, {
      params: {
        query: name,
        display,
        start: 1,
        sort: "date", // 최신순
      },
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
      timeout: REQUEST_TIMEOUT_MS,
    });

    if (!data?.items?.length) return [];

    return data.items.slice(0, display).map((item) => ({
      title: stripHtml(item.title),
      description: stripHtml(item.description),
      link: item.originallink || item.link,
      pubDate: normalizeDate(item.pubDate),
    }));
  } catch (err: any) {
    const status = err?.response?.status ?? "?";
    process.stderr.write(
      `  ✗ [news/fetchRecentNews] 네이버 뉴스 API 실패 (status=${status}, name="${name}"): ${err?.message ?? err}\n`
    );
    return [];
  }
}
