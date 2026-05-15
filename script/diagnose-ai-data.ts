/**
 * AI 분석에 필요한 데이터(법안/표결)가 DB에 얼마나 있는지 진단한다.
 * - assemblyBills, assemblyVotes 총건수
 * - 의원별 표결 보유 분포 (히스토그램)
 * - 최상위/최하위 의원 5명씩 샘플
 */
import "dotenv/config";
import { db } from "../server/db.js";
import { legislators, assemblyBills, assemblyVotes } from "../shared/schema.js";
import { sql, desc, eq } from "drizzle-orm";

async function main() {
  const [billCount] = await db.select({ c: sql<number>`count(*)::int` }).from(assemblyBills);
  const [voteCount] = await db.select({ c: sql<number>`count(*)::int` }).from(assemblyVotes);
  const [legCount] = await db.select({ c: sql<number>`count(*)::int` }).from(legislators);

  console.log("\n=== 테이블 카운트 ===");
  console.log(`  legislators   ${legCount.c}`);
  console.log(`  assemblyBills ${billCount.c}`);
  console.log(`  assemblyVotes ${voteCount.c}`);

  // 의원별 표결 수 분포
  const distRows = await db
    .select({
      legislatorId: assemblyVotes.legislatorId,
      count: sql<number>`count(*)::int`,
    })
    .from(assemblyVotes)
    .groupBy(assemblyVotes.legislatorId);

  const buckets = { "0": 0, "1-4": 0, "5-9": 0, "10-49": 0, "50+": 0 };
  for (const r of distRows) {
    if (r.count === 0) buckets["0"]++;
    else if (r.count < 5) buckets["1-4"]++;
    else if (r.count < 10) buckets["5-9"]++;
    else if (r.count < 50) buckets["10-49"]++;
    else buckets["50+"]++;
  }
  console.log("\n=== 의원별 표결 보유 분포 (실제 데이터 있는 의원만) ===");
  console.log(`  표결 0건       : (분포 대상 외 — votes에 row 자체 없음)`);
  console.log(`  표결 1-4건     : ${buckets["1-4"]}명`);
  console.log(`  표결 5-9건     : ${buckets["5-9"]}명`);
  console.log(`  표결 10-49건   : ${buckets["10-49"]}명`);
  console.log(`  표결 50건이상  : ${buckets["50+"]}명`);
  console.log(`  표결 보유 의원 총: ${distRows.length}명 / 의원 ${legCount.c}명`);

  // 표결 0건 의원 (legislators에는 있지만 votes에는 없는 케이스)
  const noVoteRows = await db.execute(sql`
    SELECT l.mona_cd, l.name
    FROM legislators l
    LEFT JOIN (SELECT DISTINCT legislator_id FROM assembly_votes) v
      ON v.legislator_id = l.mona_cd
    WHERE v.legislator_id IS NULL
    LIMIT 5
  `);
  console.log(`\n=== 표결 데이터 0건인 의원 (샘플 5명) ===`);
  for (const r of noVoteRows.rows ?? []) {
    console.log(`  • ${r.name} (${r.mona_cd})`);
  }

  // 가장 표결 많은 의원
  console.log(`\n=== 표결이 가장 많은 의원 TOP 5 ===`);
  const topRows = await db
    .select({
      legislatorId: assemblyVotes.legislatorId,
      count: sql<number>`count(*)::int`,
    })
    .from(assemblyVotes)
    .groupBy(assemblyVotes.legislatorId)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(5);
  for (const r of topRows) {
    const [m] = await db
      .select({ name: legislators.name })
      .from(legislators)
      .where(eq(legislators.monaCd, r.legislatorId));
    console.log(`  • ${m?.name ?? "?"} (${r.legislatorId}) — 표결 ${r.count}건`);
  }

  // 법안 메타데이터 매칭 점검: votes 중 billId가 bills에 없는 비율
  const [orphanCount] = await db.execute(sql`
    SELECT COUNT(*)::int AS c
    FROM assembly_votes v
    LEFT JOIN assembly_bills b ON v.bill_id = b.bill_id
    WHERE b.bill_id IS NULL
  `).then(r => r.rows as any[]);
  console.log(`\n=== assemblyVotes 중 매칭 안 되는 billId 수 ===`);
  console.log(`  ${(orphanCount as any)?.c ?? 0}건 (billName join 시 NULL → 분석 제외)`);
}

main().catch(console.error).finally(() => process.exit(0));
