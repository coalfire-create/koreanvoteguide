import { syncElectionCandidates, type SyncSummary } from "../server/nec-sync";

function printSummary(summary: SyncSummary) {
  const line = "=".repeat(60);
  console.log("");
  console.log(line);
  console.log("  Deep Sync 실행 요약 (2026 지방선거 후보)");
  console.log(line);
  console.log(`  Total fetched (API)        : ${summary.totalFetched}`);
  console.log(`  Newly inserted             : ${summary.inserted}`);
  console.log(`  Successfully updated       : ${summary.updated}`);
  console.log(`  Missing/empty photo URLs   : ${summary.missingPhoto}`);
  console.log(`  Errors                     : ${summary.errors}`);
  console.log("-".repeat(60));
  console.log("  유형별 내역");
  for (const [label, t] of Object.entries(summary.byType)) {
    console.log(
      `    - ${label.padEnd(8, " ")}  fetched=${t.fetched}  inserted=${t.inserted}  updated=${t.updated}  noPhoto=${t.missingPhoto}  errors=${t.errors}`,
    );
  }
  if (summary.matchKeySample.length > 0) {
    console.log("-".repeat(60));
    console.log("  Match key 샘플 (이름_생년월일_선거구) — 외부 전과 CSV 조인용");
    for (const k of summary.matchKeySample) {
      console.log(`    · ${k}`);
    }
  }
  console.log(line);
  console.log("");
}

async function main() {
  // 인자로 sgTypecode를 주면 해당 유형만 동기화 (예: `npm run sync:candidates -- 2`)
  const typeCodes = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
  console.log(`===== 지방선거 데이터 Deep Sync 시작 =====${typeCodes.length ? ` (유형 ${typeCodes.join(",")})` : ""}`);
  try {
    const summary = await syncElectionCandidates(typeCodes.length ? typeCodes : undefined);
    printSummary(summary);
    console.log("===== 모든 데이터 동기화 성공 =====");
    process.exit(0);
  } catch (err: any) {
    console.error("===== 동기화 중 오류 발생 =====");
    console.error(err.message);
    process.exit(1);
  }
}

main();
