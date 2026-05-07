/**
 * 공직자윤리위원회(REPA) 재산 상세 동기화
 * https://www.repa.go.kr
 */
import axios from "axios";
import { db } from "./db";
import { legislators } from "@shared/schema";
import { eq } from "drizzle-orm";
import { delay } from "./api-sync";

export interface RepaPropertyResult {
  synced: number;
  failed: number;
  errors: string[];
}

interface RepaPropertyData {
  land: number | null;
  building: number | null;
  deposit: number | null;
  stock: number | null;
  debt: number | null;
}

/**
 * 숫자 문자열 파싱 (콤마 제거, 만원 단위 정수 반환)
 * 예: "1,234" → 1234, "없음" → null
 */
function parseAmount(str: string): number | null {
  if (!str) return null;
  const cleaned = str.replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "없음" || cleaned === "0") {
    return cleaned === "0" ? 0 : null;
  }
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

/**
 * HTML 텍스트에서 테이블 행 데이터를 추출해 재산 항목 파싱
 */
function parseRepaHtml(html: string, targetName: string): RepaPropertyData | null {
  // <td> 내용 추출 헬퍼
  function extractCells(rowHtml: string): string[] {
    const cells: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let match: RegExpExecArray | null;
    while ((match = tdRegex.exec(rowHtml)) !== null) {
      // HTML 태그 제거, 공백 정리
      const text = match[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
      cells.push(text);
    }
    return cells;
  }

  // 테이블 행 순회
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;

  while ((match = trRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    const cells = extractCells(rowHtml);

    // 첫 번째 셀이 이름과 일치하는 행 찾기
    if (cells.length >= 6 && cells[0].replace(/\s/g, "") === targetName.replace(/\s/g, "")) {
      // 예상 컬럼: 성명, 소속기관, 직위, 재산총액, 토지, 건물, 예금, 유가증권, 채무, ...
      // REPA 테이블 구조에 따라 인덱스 조정 필요
      return {
        land: parseAmount(cells[4] ?? ""),
        building: parseAmount(cells[5] ?? ""),
        deposit: parseAmount(cells[6] ?? ""),
        stock: parseAmount(cells[7] ?? ""),
        debt: parseAmount(cells[8] ?? ""),
      };
    }
  }

  return null;
}

/**
 * 특정 의원 이름으로 REPA에서 재산 정보 조회
 */
async function fetchRepaProperty(name: string): Promise<RepaPropertyData | null> {
  const url = "https://www.repa.go.kr/repa/openPropertyInfo.do";
  const params = {
    searchName: name,
    searchYear: "2024",
    gubun: "3",       // 국회의원 구분
    pageNo: "1",
  };

  const response = await axios.get(url, {
    params,
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; KoreanVoteGuide/1.0)",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    maxRedirects: 5,
  });

  const html: string = response.data as string;
  return parseRepaHtml(html, name);
}

/**
 * 전체 국회의원 REPA 재산 상세 동기화
 */
export async function syncRepaPropertyDetails(): Promise<RepaPropertyResult> {
  console.log("[repa-sync] 공직자윤리위원회 재산 상세 동기화 시작...");
  const errors: string[] = [];
  let synced = 0;
  let failed = 0;

  const allLegislators = await db.select({
    monaCd: legislators.monaCd,
    name: legislators.name,
  }).from(legislators);

  console.log(`[repa-sync] 총 ${allLegislators.length}명 처리 예정`);

  for (const leg of allLegislators) {
    try {
      await delay(1000);
      const data = await fetchRepaProperty(leg.name);

      if (data) {
        await db
          .update(legislators)
          .set({
            propertyLand: data.land,
            propertyBuilding: data.building,
            propertyDeposit: data.deposit,
            propertyStock: data.stock,
            propertyDebt: data.debt,
            propertyDetailSyncedAt: new Date(),
          })
          .where(eq(legislators.monaCd, leg.monaCd));
        synced++;
        console.log(`[repa-sync] ${leg.name} 완료`);
      } else {
        // 데이터 없음도 동기화 시도로 기록
        await db
          .update(legislators)
          .set({ propertyDetailSyncedAt: new Date() })
          .where(eq(legislators.monaCd, leg.monaCd));
        failed++;
        console.log(`[repa-sync] ${leg.name} 데이터 없음`);
      }
    } catch (err: any) {
      failed++;
      const msg = `${leg.name}(${leg.monaCd}): ${err.message}`;
      errors.push(msg);
      console.error(`[repa-sync] 오류 - ${msg}`);
    }
  }

  console.log(`[repa-sync] 완료: ${synced}명 갱신, ${failed}명 실패`);
  return { synced, failed, errors };
}

/**
 * 특정 이름 목록만 REPA 동기화 (부분 갱신용)
 */
export async function syncRepaPropertyDetailsBatch(names: string[]): Promise<RepaPropertyResult> {
  console.log(`[repa-sync] 배치 동기화 시작: ${names.length}명`);
  const errors: string[] = [];
  let synced = 0;
  let failed = 0;

  const matchedLegislators = await db.select({
    monaCd: legislators.monaCd,
    name: legislators.name,
  }).from(legislators);

  const filtered = matchedLegislators.filter((l) => names.includes(l.name));

  for (const leg of filtered) {
    try {
      await delay(1000);
      const data = await fetchRepaProperty(leg.name);

      if (data) {
        await db
          .update(legislators)
          .set({
            propertyLand: data.land,
            propertyBuilding: data.building,
            propertyDeposit: data.deposit,
            propertyStock: data.stock,
            propertyDebt: data.debt,
            propertyDetailSyncedAt: new Date(),
          })
          .where(eq(legislators.monaCd, leg.monaCd));
        synced++;
      } else {
        await db
          .update(legislators)
          .set({ propertyDetailSyncedAt: new Date() })
          .where(eq(legislators.monaCd, leg.monaCd));
        failed++;
      }
    } catch (err: any) {
      failed++;
      errors.push(`${leg.name}(${leg.monaCd}): ${err.message}`);
    }
  }

  return { synced, failed, errors };
}
