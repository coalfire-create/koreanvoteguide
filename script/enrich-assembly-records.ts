/**
 * enrich-assembly-records.ts
 *
 * 22대 국회 표결 데이터를 DB(assembly_votes)에 영구 저장한다.
 *
 * 동작:
 *   1) assembly_bills에서 통과/심사 완료된 법안 ID 목록 수집
 *   2) 각 법안에 대해 fetchBillMemberVotes(billId) 호출 → 의원별 표결 수신
 *   3) assembly_votes에 (billId, legislatorId) 유니크 키 기준 upsert
 *   4) 진행 상황 / 에러 / 통계 출력
 *
 * 실행:
 *   npm run enrich:assembly-records             # 신규 + 미동기화 법안만
 *   npm run enrich:assembly-records -- --force  # 전체 법안 재동기화
 *   npm run enrich:assembly-records -- --limit=200  # 최근 200건만
 *
 * 설계 노트:
 *   - 동시성: p-limit 5건 (Naver/국회 API 부하 균형)
 *   - 백오프: 5xx/timeout 시 1s → 2s → 4s 지수 재시도
 *   - 배치: 의원별 표결을 모두 모아 50건 단위로 DB upsert
 */

import "dotenv/config";
import axios, { AxiosError } from "axios";
import pLimit from "p-limit";
import { db } from "../server/db.js";
import { assemblyBills, assemblyVotes } from "../shared/schema.js";
import { eq, sql, isNull, or, desc, lt } from "drizzle-orm";

const API_BASE = "https://open.assembly.go.kr/portal/openapi";
const API_KEY = process.env.OPEN_ASSEMBLY_API_KEY || process.env.ASSEMBLY_API_KEY;

const CONFIG = {
  CONCURRENCY: 5,
  PAGE_SIZE: 100,
  RETRY_MAX: 3,
  BACKOFF_BASE_MS: 1000,
  REQUEST_TIMEOUT_MS: 30000,
  DELAY_MIN_MS: 250,
  DELAY_MAX_MS: 600,
  UPSERT_BATCH: 200,
};

function randomDelay() {
  return new Promise<void>((r) =>
    setTimeout(r, CONFIG.DELAY_MIN_MS + Math.floor(Math.random() * (CONFIG.DELAY_MAX_MS - CONFIG.DELAY_MIN_MS)))
  );
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T | null> {
  for (let attempt = 0; attempt <= CONFIG.RETRY_MAX; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err instanceof AxiosError ? err.response?.status : null;
      // 4xx (429 제외)는 재시도해도 무의미
      if (status && status >= 400 && status < 500 && status !== 429) return null;
      if (attempt === CONFIG.RETRY_MAX) {
        process.stderr.write(`  ✗ [${label}] 최종 실패 (${status ?? "network"})\n`);
        return null;
      }
      const delay = CONFIG.BACKOFF_BASE_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

interface MemberVoteRow {
  billId: string;
  legislatorId: string;
  legislatorName: string;
  party: string;
  voteResult: string;
}

async function fetchBillVotesAllPages(billId: string): Promise<MemberVoteRow[]> {
  if (!API_KEY) throw new Error("OPEN_ASSEMBLY_API_KEY 미설정");
  const rows: MemberVoteRow[] = [];
  let pIndex = 1;

  while (true) {
    const page = await withRetry(async () => {
      const { data } = await axios.get(`${API_BASE}/nojepdqqaweusdfbi`, {
        params: {
          Key: API_KEY,
          Type: "json",
          BILL_ID: billId,
          pIndex: String(pIndex),
          pSize: String(CONFIG.PAGE_SIZE),
        },
        timeout: CONFIG.REQUEST_TIMEOUT_MS,
      });
      const service = data?.nojepdqqaweusdfbi;
      if (!service || !Array.isArray(service)) return null;
      const head = service[0]?.head;
      const code = head?.[1]?.RESULT?.CODE;
      if (code && code !== "INFO-000") return null; // INFO-200 등은 빈 페이지로 종료
      const totalCount = parseInt(head?.[0]?.list_total_count) || 0;
      const pageRows: any[] = Array.isArray(service[1]?.row) ? service[1].row : [];
      return { totalCount, pageRows };
    }, `bill/${billId}/p${pIndex}`);

    if (!page) break;
    if (page.pageRows.length === 0) break;

    for (const r of page.pageRows) {
      const legislatorId = r.MONA_CD || "";
      if (!legislatorId) continue;
      rows.push({
        billId,
        legislatorId,
        legislatorName: r.HG_NM || "",
        party: r.POLY_NM || "",
        voteResult: r.RESULT_VOTE_MOD || r.VOTE_RESULT || "알 수 없음",
      });
    }

    const totalPages = Math.ceil(page.totalCount / CONFIG.PAGE_SIZE);
    if (pIndex >= totalPages || page.pageRows.length < CONFIG.PAGE_SIZE) break;
    pIndex++;
    await randomDelay();
  }

  return rows;
}

async function upsertVotes(rows: MemberVoteRow[]): Promise<number> {
  if (!rows.length) return 0;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CONFIG.UPSERT_BATCH) {
    const chunk = rows.slice(i, i + CONFIG.UPSERT_BATCH);
    try {
      await db
        .insert(assemblyVotes)
        .values(chunk.map((r) => ({ ...r, syncedAt: new Date() })))
        .onConflictDoUpdate({
          target: [assemblyVotes.billId, assemblyVotes.legislatorId],
          set: {
            voteResult: sql`EXCLUDED.vote_result`,
            party: sql`EXCLUDED.party`,
            legislatorName: sql`EXCLUDED.legislator_name`,
            syncedAt: sql`EXCLUDED.synced_at`,
          },
        });
      inserted += chunk.length;
    } catch (err: any) {
      process.stderr.write(`  ✗ upsert 실패 (${chunk.length}건): ${err.message}\n`);
    }
  }
  return inserted;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 0;

  if (!API_KEY) {
    console.error("✗ OPEN_ASSEMBLY_API_KEY (또는 ASSEMBLY_API_KEY) 환경변수가 필요합니다.");
    process.exit(1);
  }

  console.log(`\n[enrich-assembly-records] 시작 — force=${force}, limit=${limit || "all"}`);

  // 대상 법안: 통과/심사 완료된 법안 우선. force가 아니면 syncedAt이 오래된 것을 우선.
  // assembly_bills.syncedAt는 "법안 메타" 동기화 시각. 표결 동기화 여부는 votes 테이블에서 가늠.
  // 가장 간단한 우선순위: PROC_DT가 있는 법안 → 최신순.
  const rows = await db
    .select({ billId: assemblyBills.billId, billName: assemblyBills.billName })
    .from(assemblyBills)
    .where(
      // 처리결과가 있는 법안만 (표결 자체가 발생한 법안)
      sql`${assemblyBills.result} IS NOT NULL AND ${assemblyBills.result} != ''`
    )
    .orderBy(desc(assemblyBills.proposeDate));

  let candidates = rows;
  if (!force) {
    // 이미 표결이 DB에 있는 법안은 스킵
    const haveVotes = await db
      .select({ billId: assemblyVotes.billId })
      .from(assemblyVotes)
      .groupBy(assemblyVotes.billId);
    const have = new Set(haveVotes.map((r) => r.billId));
    candidates = candidates.filter((r) => !have.has(r.billId));
  }
  if (limit > 0) candidates = candidates.slice(0, limit);

  console.log(`  대상 법안: ${candidates.length}건 (전체 처리된 ${rows.length}건 중)\n`);

  const limiter = pLimit(CONFIG.CONCURRENCY);
  let processedBills = 0;
  let totalVoteRows = 0;
  let totalInserted = 0;
  let zeroVoteBills = 0;
  const started = Date.now();

  const tasks = candidates.map((bill, idx) =>
    limiter(async () => {
      if (idx > 0) await randomDelay();
      const votes = await fetchBillVotesAllPages(bill.billId);
      processedBills++;

      if (votes.length === 0) {
        zeroVoteBills++;
      } else {
        const inserted = await upsertVotes(votes);
        totalVoteRows += votes.length;
        totalInserted += inserted;
      }

      if (processedBills % 25 === 0 || processedBills === candidates.length) {
        const pct = Math.round((processedBills / candidates.length) * 100);
        const elapsed = ((Date.now() - started) / 1000).toFixed(0);
        console.log(
          `  [${pct.toString().padStart(3)}%] ${processedBills}/${candidates.length} 법안 — 표결 누적 ${totalInserted}건 (${elapsed}s)`
        );
      }
    })
  );

  await Promise.allSettled(tasks);

  console.log(`\n[enrich-assembly-records] 완료`);
  console.log(`  처리 법안       : ${processedBills}건`);
  console.log(`  표결 수신       : ${totalVoteRows}건`);
  console.log(`  DB upsert 성공  : ${totalInserted}건`);
  console.log(`  표결 0건 법안   : ${zeroVoteBills}건 (호명투표 없는 결의/위원장안 등)`);

  // 최종 상태
  const [{ c: voteTotal }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(assemblyVotes);
  const [{ c: legCount }] = await db
    .select({ c: sql<number>`count(distinct legislator_id)::int` })
    .from(assemblyVotes);
  console.log(`\n  → 현재 assembly_votes 총 ${voteTotal}건, 표결 보유 의원 ${legCount}명`);
}

main()
  .catch((err) => {
    console.error("\n💥 enrich-assembly-records 치명적 오류:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
