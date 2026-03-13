import axios from "axios";
import { db } from "./db";
import { legislators, assemblyBills, assemblyVotes } from "@shared/schema";
import { sql } from "drizzle-orm";

const API_BASE = "https://open.assembly.go.kr/portal/openapi";
const API_KEY = process.env.OPEN_ASSEMBLY_API_KEY || process.env.ASSEMBLY_API_KEY;
const AGE = "22";

async function fetchPage(serviceId: string, params: Record<string, string> = {}): Promise<any[]> {
  if (!API_KEY) throw new Error("API 키가 설정되지 않았습니다 (OPEN_ASSEMBLY_API_KEY 또는 ASSEMBLY_API_KEY)");

  const response = await axios.get(`${API_BASE}/${serviceId}`, {
    params: { Key: API_KEY, Type: "json", pIndex: "1", pSize: "300", AGE, ...params },
    timeout: 30000,
  });

  const serviceData = response.data?.[serviceId];
  if (!serviceData || !Array.isArray(serviceData)) {
    const errorInfo = serviceData?.[0]?.head?.[1]?.RESULT;
    if (errorInfo?.CODE && errorInfo.CODE !== "INFO-000") {
      throw new Error(`API 오류: ${errorInfo.MESSAGE || errorInfo.CODE}`);
    }
    return [];
  }

  const result = serviceData[0]?.head?.[1]?.RESULT;
  if (result?.CODE && result.CODE !== "INFO-000") {
    throw new Error(`API 오류: ${result.MESSAGE || result.CODE}`);
  }

  const rows = serviceData[1]?.row;
  return Array.isArray(rows) ? rows : [];
}

export async function syncLegislators(): Promise<{ synced: number; errors: string[] }> {
  console.log("[api-sync] 국회의원 동기화 시작...");
  const errors: string[] = [];
  let synced = 0;

  try {
    const rows = await fetchPage("nwvrqwxyaytdsfvhu");
    console.log(`[api-sync] 국회의원 ${rows.length}명 수신`);

    for (const row of rows) {
      const monaCd = row.MONA_CD || row.HG_NM;
      if (!monaCd) { errors.push(`MONA_CD 없음: ${JSON.stringify(row).substring(0, 80)}`); continue; }

      try {
        await db
          .insert(legislators)
          .values({
            monaCd,
            name: row.HG_NM || "",
            party: row.POLY_NM || "",
            district: row.ORIG_NM || "비례대표",
            photoUrl: row.HG_NM_A ? `https://open.assembly.go.kr/portal/assm/assmpic/${row.HG_NM_A}` : "",
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
  console.log("[api-sync] 법안 동기화 시작...");
  const errors: string[] = [];
  let synced = 0;

  try {
    const rows = await fetchPage("nzmimeepazxkubdpn", { pSize: "100" });
    console.log(`[api-sync] 법안 ${rows.length}건 수신`);

    for (const row of rows) {
      const billId = row.BILL_ID;
      if (!billId) { errors.push(`BILL_ID 없음`); continue; }

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
  console.log("[api-sync] 표결 동기화 시작...");
  const errors: string[] = [];
  let synced = 0;

  try {
    const rows = await fetchPage("ncocpgfiemocjntve", { pSize: "100" });
    console.log(`[api-sync] 표결 기록 ${rows.length}건 수신`);

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

export async function syncAll(): Promise<{
  legislators: { synced: number; errors: string[] };
  bills: { synced: number; errors: string[] };
  votes: { synced: number; errors: string[] };
}> {
  console.log("[api-sync] ===== 전체 동기화 시작 =====");
  const start = Date.now();

  const legResult = await syncLegislators();
  await new Promise(r => setTimeout(r, 500));
  const billResult = await syncBills();
  await new Promise(r => setTimeout(r, 500));
  const voteResult = await syncVotes();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[api-sync] ===== 전체 동기화 완료 (${elapsed}초) =====`);
  console.log(`  - 의원: ${legResult.synced}명 (오류 ${legResult.errors.length}건)`);
  console.log(`  - 법안: ${billResult.synced}건 (오류 ${billResult.errors.length}건)`);
  console.log(`  - 표결: ${voteResult.synced}건 (오류 ${voteResult.errors.length}건)`);

  return { legislators: legResult, bills: billResult, votes: voteResult };
}
