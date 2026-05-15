/**
 * 기존 electionType='mayor' 데이터 정리
 * NEC 동기화 이후 실제 데이터는 '시도지사'로 들어옴.
 * 구형 'mayor' 행은 mock 데이터이므로 제거.
 */
import { db } from "../server/db";
import { electionCandidates } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  // 먼저 'mayor' 행 확인
  const mayorRows = await db
    .select({ id: electionCandidates.id, name: electionCandidates.name, party: electionCandidates.party })
    .from(electionCandidates)
    .where(eq(electionCandidates.electionType, "mayor"));

  console.log(`[cleanup] electionType='mayor' 행 수: ${mayorRows.length}`);
  for (const row of mayorRows) {
    console.log(`  - ${row.name} (${row.party})`);
  }

  if (mayorRows.length > 0) {
    await db.delete(electionCandidates).where(eq(electionCandidates.electionType, "mayor"));
    console.log(`[cleanup] ${mayorRows.length}개 구형 'mayor' 행 삭제 완료`);
  }

  // 최종 카운트
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(electionCandidates);
  console.log(`\n[cleanup] election_candidates 최종 행 수: ${countResult[0]?.count}`);

  const byType = await db
    .select({
      electionType: electionCandidates.electionType,
      count: sql<number>`COUNT(*)`,
    })
    .from(electionCandidates)
    .groupBy(electionCandidates.electionType);
  console.log("유형별 행 수:");
  for (const row of byType) {
    console.log(`  ${row.electionType}: ${row.count}`);
  }

  process.exit(0);
}

main();
