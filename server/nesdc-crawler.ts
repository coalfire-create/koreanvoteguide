/**
 * 중앙선거여론조사심의위원회 (nesdc.go.kr) 여론조사 크롤러
 * 공표된 여론조사 결과를 수집해 DB에 저장합니다.
 */
import axios from "axios";
import * as cheerio from "cheerio";
import { db } from "./db";
import { pollResults } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const BASE_URL = "https://www.nesdc.go.kr";
const LIST_URL = `${BASE_URL}/nesdc/poll/pollList.do`;
const DETAIL_URL = `${BASE_URL}/nesdc/poll/pollView.do`;

// 인메모리 캐시 (1시간)
let cache: { data: any[]; cachedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000;

const headers = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9",
  "Referer": BASE_URL,
};

/**
 * 여론조사 목록 페이지 크롤링
 */
async function fetchPollList(page = 1): Promise<any[]> {
  const res = await axios.get(LIST_URL, {
    params: {
      pageIndex: page,
      sgId: "20260604",   // 2026 지방선거
      searchGubun: "",
      searchKeyword: "",
    },
    headers,
    timeout: 15000,
  });

  const $ = cheerio.load(res.data);
  const items: any[] = [];

  // 목록 테이블 파싱
  $("table tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 5) return;

    const link = $(cells[1]).find("a");
    const href = link.attr("href") || "";
    const onclickMatch = href.match(/pollSeq=(\d+)/) || $(cells[1]).find("a").attr("onclick")?.match(/(\d+)/);
    const pollSeq = onclickMatch?.[1];

    items.push({
      pollSeq,
      title: link.text().trim(),
      commissioner: $(cells[2]).text().trim(),
      surveyOrg: $(cells[3]).text().trim(),
      publishedDate: $(cells[4]).text().trim(),
    });
  });

  return items;
}

/**
 * 여론조사 상세 페이지에서 후보별 지지율 파싱
 */
async function fetchPollDetail(pollSeq: string): Promise<any | null> {
  try {
    const res = await axios.get(DETAIL_URL, {
      params: { pollSeq },
      headers,
      timeout: 15000,
    });

    const $ = cheerio.load(res.data);
    const candidates: { name: string; party: string; rate: number }[] = [];

    // 후보별 지지율 테이블 파싱 (nesdc 구조)
    $("table").each((_, table) => {
      const headers = $(table).find("th").map((_, th) => $(th).text().trim()).get();
      if (!headers.some(h => h.includes("후보") || h.includes("지지율") || h.includes("%"))) return;

      $(table).find("tbody tr").each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length < 2) return;

        const nameCell = $(cells[0]).text().trim();
        const rateCell = $(cells[cells.length - 1]).text().trim().replace("%", "");
        const rate = parseFloat(rateCell);

        if (nameCell && !isNaN(rate) && rate >= 0 && rate <= 100) {
          // "홍길동(민주당)" 또는 "홍길동 / 민주당" 형식 파싱
          const nameMatch = nameCell.match(/^([^(\/\s]+)\s*[(\/ ]?\s*([^)]*)\)?$/);
          candidates.push({
            name: nameMatch?.[1]?.trim() || nameCell,
            party: nameMatch?.[2]?.trim() || "",
            rate,
          });
        }
      });
    });

    if (candidates.length === 0) return null;

    // 조사기간, 표본수 파싱
    let surveyDate = "";
    let sampleSize: number | null = null;
    let regionCode = "";
    let electionType = "";

    $("table.tbl_view tr, .view_cont tr").each((_, row) => {
      const th = $(row).find("th").text().trim();
      const td = $(row).find("td").text().trim();
      if (th.includes("조사기간") || th.includes("기간")) surveyDate = td;
      if (th.includes("표본") || th.includes("응답")) sampleSize = parseInt(td.replace(/[^0-9]/g, "")) || null;
      if (th.includes("조사지역") || th.includes("지역")) regionCode = td;
      if (th.includes("선거종류") || th.includes("선거구")) electionType = td;
    });

    return { candidates, surveyDate, sampleSize, regionCode, electionType };
  } catch (e) {
    return null;
  }
}

/**
 * 전체 크롤링 실행 및 DB 저장
 */
export async function crawlNesdcPolls(): Promise<{ saved: number; errors: number }> {
  console.log("[nesdc] 여론조사 크롤링 시작...");
  let saved = 0;
  let errors = 0;

  try {
    const items = await fetchPollList(1);
    console.log(`[nesdc] 목록 ${items.length}건 수집`);

    for (const item of items.slice(0, 20)) { // 최신 20건만
      if (!item.pollSeq) continue;

      try {
        await new Promise(r => setTimeout(r, 800)); // 서버 부하 방지
        const detail = await fetchPollDetail(item.pollSeq);
        if (!detail || detail.candidates.length === 0) continue;

        // 지역코드 정규화
        const regionCode = normalizeRegion(detail.regionCode || item.title);
        const districtName = item.title.replace(/여론조사.*$/, "").trim();
        const electionType = normalizeElectionType(detail.electionType || item.title);

        await db.insert(pollResults).values({
          regionCode,
          districtName,
          electionType,
          surveyOrg: item.surveyOrg || "미상",
          commissioner: item.commissioner || "미상",
          surveyDate: detail.surveyDate || "",
          publishedDate: item.publishedDate || "",
          sampleSize: detail.sampleSize,
          candidates: detail.candidates,
          sourceUrl: `${DETAIL_URL}?pollSeq=${item.pollSeq}`,
        }).onConflictDoNothing();

        saved++;
        console.log(`[nesdc] 저장: ${districtName} (${detail.candidates.map((c: any) => `${c.name} ${c.rate}%`).join(", ")})`);
      } catch (e: any) {
        console.error(`[nesdc] 상세 오류 (${item.pollSeq}):`, e.message);
        errors++;
      }
    }
  } catch (e: any) {
    console.error("[nesdc] 목록 크롤링 실패:", e.message);
    errors++;
  }

  // 캐시 초기화
  cache = null;
  console.log(`[nesdc] 완료: 저장 ${saved}건, 오류 ${errors}건`);
  return { saved, errors };
}

/**
 * 지역별 최신 여론조사 조회 (캐시 포함)
 */
export async function getLatestPolls(regionCode: string): Promise<any[]> {
  // 인메모리 캐시 확인
  const now = Date.now();
  if (cache && now - cache.cachedAt < CACHE_TTL) {
    return cache.data.filter(p => p.regionCode === regionCode || p.regionCode.includes(regionCode));
  }

  // DB에서 조회 (지역별 최신 3건)
  const rows = await db
    .select()
    .from(pollResults)
    .orderBy(pollResults.scrapedAt)
    .limit(50);

  cache = { data: rows, cachedAt: now };
  return rows.filter(p => !regionCode || p.regionCode === regionCode || p.regionCode.includes(regionCode));
}

function normalizeRegion(text: string): string {
  const map: Record<string, string> = {
    "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시",
    "인천": "인천광역시", "광주": "광주광역시", "대전": "대전광역시",
    "울산": "울산광역시", "세종": "세종특별자치시", "경기": "경기도",
    "강원": "강원특별자치도", "충북": "충청북도", "충남": "충청남도",
    "전북": "전북특별자치도", "전남": "전라남도", "경북": "경상북도",
    "경남": "경상남도", "제주": "제주특별자치도",
  };
  for (const [short, full] of Object.entries(map)) {
    if (text.includes(short)) return full;
  }
  return text;
}

function normalizeElectionType(text: string): string {
  if (text.includes("시장") || text.includes("지사") || text.includes("시도지사")) return "시도지사";
  if (text.includes("구청장") || text.includes("군수") || text.includes("시장")) return "구시군의장";
  if (text.includes("교육감")) return "교육감";
  return "시도지사";
}
