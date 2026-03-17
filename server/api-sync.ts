import axios from "axios";
import { db } from "./db";
import { legislators, assemblyBills, assemblyVotes } from "@shared/schema";
import { sql } from "drizzle-orm";

const API_BASE = "https://open.assembly.go.kr/portal/openapi";
const API_KEY = process.env.OPEN_ASSEMBLY_API_KEY || process.env.ASSEMBLY_API_KEY;
const AGE = "22";
const PAGE_SIZE = 100;
const DELAY_MS = 500;

export function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

interface PageResult {
  rows: any[];
  totalCount: number;
}

async function fetchOnePage(
  serviceId: string,
  pIndex: number,
  extraParams: Record<string, string> = {}
): Promise<PageResult> {
  if (!API_KEY) throw new Error("API 키가 설정되지 않았습니다 (OPEN_ASSEMBLY_API_KEY 또는 ASSEMBLY_API_KEY)");

  const response = await axios.get(`${API_BASE}/${serviceId}`, {
    params: {
      Key: API_KEY,
      Type: "json",
      AGE,
      pIndex: String(pIndex),
      pSize: String(PAGE_SIZE),
      ...extraParams,
    },
    timeout: 30000,
  });

  const serviceData = response.data?.[serviceId];
  if (!serviceData || !Array.isArray(serviceData)) {
    const errorInfo = serviceData?.[0]?.head?.[1]?.RESULT;
    if (errorInfo?.CODE && errorInfo.CODE !== "INFO-000") {
      throw new Error(`API 오류: ${errorInfo.MESSAGE || errorInfo.CODE}`);
    }
    return { rows: [], totalCount: 0 };
  }

  const head = serviceData[0]?.head;
  const result = head?.[1]?.RESULT;
  if (result?.CODE && result.CODE !== "INFO-000") {
    throw new Error(`API 오류: ${result.MESSAGE || result.CODE}`);
  }

  const totalCount: number = parseInt(head?.[0]?.list_total_count) || 0;
  const rows = serviceData[1]?.row;
  return { rows: Array.isArray(rows) ? rows : [], totalCount };
}

async function fetchAllPages(
  serviceId: string,
  extraParams: Record<string, string> = {}
): Promise<any[]> {
  const allRows: any[] = [];
  let pIndex = 1;

  console.log(`[api-sync] ${serviceId} 1페이지 조회 중...`);
  const first = await fetchOnePage(serviceId, pIndex, extraParams);
  allRows.push(...first.rows);

  const totalCount = first.totalCount;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  console.log(`[api-sync] 전체 ${totalCount}건 / ${totalPages}페이지`);

  while (pIndex < totalPages) {
    pIndex++;
    await delay(DELAY_MS);
    console.log(`[api-sync] ${serviceId} ${pIndex}/${totalPages} 페이지 조회 중...`);
    const page = await fetchOnePage(serviceId, pIndex, extraParams);
    if (page.rows.length === 0) break;
    allRows.push(...page.rows);
  }

  return allRows;
}

export async function syncLegislators(): Promise<{ synced: number; errors: string[] }> {
  console.log("[api-sync] 국회의원 동기화 시작...");
  const errors: string[] = [];
  let synced = 0;

  try {
    const rows = await fetchAllPages("nwvrqwxyaytdsfvhu");
    console.log(`[api-sync] 국회의원 총 ${rows.length}명 수신`);

    for (const row of rows) {
      const monaCd = row.MONA_CD || row.HG_NM;
      if (!monaCd) {
        errors.push(`MONA_CD 없음: ${JSON.stringify(row).substring(0, 80)}`);
        continue;
      }

      try {
        await db
          .insert(legislators)
          .values({
            monaCd,
            name: row.HG_NM || "",
            party: row.POLY_NM || "",
            district: row.ORIG_NM || "비례대표",
            photoUrl: row.HG_NM_A
              ? `https://open.assembly.go.kr/portal/assm/assmpic/${row.HG_NM_A}`
              : "",
            committee: row.CMIT_NM || "",
            electedTerm: 22,
            syncedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: legislators.monaCd,
            set: {
              name: sql`EXCLUDED.name`,
              party: sql`EXCLUDED.party`,
              district: sql`EXCLUDED.district`,
              photoUrl: sql`EXCLUDED.photo_url`,
              committee: sql`EXCLUDED.committee`,
              syncedAt: sql`EXCLUDED.synced_at`,
            },
          });
        synced++;
      } catch (err: any) {
        errors.push(`의원 upsert 오류 (${monaCd}): ${err.message}`);
      }
    }
  } catch (err: any) {
    const msg = `국회의원 API 호출 실패: ${err.message}`;
    console.error(`[api-sync] ${msg}`);
    errors.push(msg);
  }

  console.log(`[api-sync] 국회의원 동기화 완료: ${synced}명, 오류: ${errors.length}건`);
  return { synced, errors };
}

export async function syncBills(): Promise<{ synced: number; errors: string[] }> {
  console.log("[api-sync] 법안 동기화 시작 (전체 페이지 수집)...");
  const errors: string[] = [];
  let synced = 0;

  try {
    const rows = await fetchAllPages("nzmimeepazxkubdpn");
    console.log(`[api-sync] 법안 총 ${rows.length}건 수신`);

    for (const row of rows) {
      const billId = row.BILL_ID;
      if (!billId) {
        errors.push(`BILL_ID 없음`);
        continue;
      }

      try {
        await db
          .insert(assemblyBills)
          .values({
            billId,
            billNo: row.BILL_NO || "",
            billName: row.BILL_NM || "",
            proposer: row.PROPOSER || "",
            proposeDate: row.PROPOSE_DT || "",
            result: row.PROC_RESULT_CD || "",
            committee: row.COMMITTEE_NM || "",
            yesCount: parseInt(row.YES_TCNT) || 0,
            noCount: parseInt(row.NO_TCNT) || 0,
            abstainCount: parseInt(row.BLANK_TCNT) || 0,
            syncedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: assemblyBills.billId,
            set: {
              billName: sql`EXCLUDED.bill_name`,
              proposer: sql`EXCLUDED.proposer`,
              proposeDate: sql`EXCLUDED.propose_date`,
              result: sql`EXCLUDED.result`,
              committee: sql`EXCLUDED.committee`,
              yesCount: sql`EXCLUDED.yes_count`,
              noCount: sql`EXCLUDED.no_count`,
              abstainCount: sql`EXCLUDED.abstain_count`,
              syncedAt: sql`EXCLUDED.synced_at`,
            },
          });
        synced++;
      } catch (err: any) {
        errors.push(`법안 upsert 오류 (${billId}): ${err.message}`);
      }
    }
  } catch (err: any) {
    const msg = `법안 API 호출 실패: ${err.message}`;
    console.error(`[api-sync] ${msg}`);
    errors.push(msg);
  }

  console.log(`[api-sync] 법안 동기화 완료: ${synced}건, 오류: ${errors.length}건`);
  return { synced, errors };
}

export async function syncVotes(): Promise<{ synced: number; errors: string[] }> {
  console.log("[api-sync] 표결 동기화 시작 (전체 페이지 수집)...");
  const errors: string[] = [];
  let synced = 0;

  try {
    const rows = await fetchAllPages("nojepdqqaweusdfbi");
    console.log(`[api-sync] 표결 기록 총 ${rows.length}건 수신`);

    for (const row of rows) {
      const billId = row.BILL_ID;
      const legislatorId = row.MONA_CD;
      if (!billId || !legislatorId) {
        errors.push(`BILL_ID 또는 MONA_CD 없음: ${JSON.stringify(row).substring(0, 80)}`);
        continue;
      }

      const voteResult = row.RESULT_VOTE_MOD || row.VOTE_RESULT || "알 수 없음";

      try {
        await db
          .insert(assemblyVotes)
          .values({
            billId,
            legislatorId,
            legislatorName: row.HG_NM || "",
            party: row.POLY_NM || "",
            voteResult,
            syncedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [assemblyVotes.billId, assemblyVotes.legislatorId],
            set: {
              voteResult: sql`EXCLUDED.vote_result`,
              party: sql`EXCLUDED.party`,
              legislatorName: sql`EXCLUDED.legislator_name`,
              syncedAt: sql`EXCLUDED.synced_at`,
            },
          });
        synced++;
      } catch (err: any) {
        errors.push(`표결 upsert 오류 (${billId}/${legislatorId}): ${err.message}`);
      }
    }
  } catch (err: any) {
    const msg = `표결 API 호출 실패: ${err.message}`;
    console.error(`[api-sync] ${msg}`);
    errors.push(msg);
  }

  console.log(`[api-sync] 표결 동기화 완료: ${synced}건, 오류: ${errors.length}건`);
  return { synced, errors };
}

export interface MemberVote {
  legislatorId: string;
  legislatorName: string;
  party: string;
  voteResult: string;
}

export async function fetchBillMemberVotes(billId: string): Promise<{ votes: MemberVote[]; billName: string }> {
  console.log(`[api-sync] 법안 ${billId} 의원 표결 조회 시작...`);
  try {
    const rows = await fetchAllPages("nojepdqqaweusdfbi", { BILL_ID: billId });
    console.log(`[api-sync] 법안 ${billId} 표결 ${rows.length}건 수신`);
    const billName: string = rows[0]?.BILL_NAME || billId;
    const votes = rows.map((r: any) => ({
      legislatorId: r.MONA_CD || "",
      legislatorName: r.HG_NM || "",
      party: r.POLY_NM || "",
      voteResult: r.RESULT_VOTE_MOD || "알 수 없음",
    }));
    return { votes, billName };
  } catch (err: any) {
    console.error(`[api-sync] 법안 ${billId} 표결 조회 실패: ${err.message}`);
    return { votes: [], billName: billId };
  }
}

export async function fetchEnactedBillsFromApi(fetchPageCount = 30): Promise<any[]> {
  console.log(`[api-sync] 가결 법안 조회 시작 (뒤 ${fetchPageCount}페이지)...`);
  const enacted: any[] = [];

  const { rows: firstRows, totalCount } = await fetchOnePage("nzmimeepazxkubdpn", 1);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  console.log(`[api-sync] 전체 ${totalCount}건 / ${totalPages}페이지, 마지막 ${fetchPageCount}페이지 조회 예정`);

  const startPage = Math.max(1, totalPages - fetchPageCount + 1);

  for (let page = startPage; page <= totalPages; page++) {
    try {
      const { rows } = await fetchOnePage("nzmimeepazxkubdpn", page);
      const procResult = (r: any) => r.PROC_RESULT_CD || r.PROC_RESULT || "";
      const passed = rows.filter((r: any) => procResult(r).trim() !== "" && !procResult(r).includes("철회"));
      enacted.push(...passed);
      console.log(`[api-sync] 페이지 ${page}/${totalPages}: ${rows.length}건 조회, 처리됨 ${passed.length}건 (누계 ${enacted.length}건)`);
      if (rows.length < PAGE_SIZE) break;
      if (page < totalPages) await delay(DELAY_MS);
    } catch (err: any) {
      console.error(`[api-sync] 페이지 ${page} 조회 실패: ${err.message}`);
      break;
    }
  }

  console.log(`[api-sync] 가결 법안 조회 완료: 총 ${enacted.length}건`);
  return enacted;
}

export async function syncAll(): Promise<{
  legislators: { synced: number; errors: string[] };
  bills: { synced: number; errors: string[] };
  votes: { synced: number; errors: string[] };
}> {
  console.log("[api-sync] ===== 전체 동기화 시작 =====");
  const start = Date.now();

  const legResult = await syncLegislators();
  await delay(DELAY_MS);
  const billResult = await syncBills();
  await delay(DELAY_MS);
  const voteResult = await syncVotes();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[api-sync] ===== 전체 동기화 완료 (${elapsed}초) =====`);
  console.log(`  - 의원: ${legResult.synced}명 (오류 ${legResult.errors.length}건)`);
  console.log(`  - 법안: ${billResult.synced}건 (오류 ${billResult.errors.length}건)`);
  console.log(`  - 표결: ${voteResult.synced}건 (오류 ${voteResult.errors.length}건)`);

  return { legislators: legResult, bills: billResult, votes: voteResult };
}
