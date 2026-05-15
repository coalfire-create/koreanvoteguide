// 선관위 5대 공약 본문(goalCont/methCont/distCont/deptCont)을 후보별로 fetch해
// election_candidates.pledges JSONB에 채워넣는 일회성/주기 실행 스크립트.
//
// 사용:
//   npm run enrich:pledges           # 비어있는 후보만 보강
//   npm run enrich:pledges -- --force  # 전체 강제 갱신

import { enrichCandidatePledges } from "../server/nec-sync";

async function main() {
  const force = process.argv.includes("--force");
  console.log(`[enrich-pledges] 시작 (force=${force})`);
  const result = await enrichCandidatePledges({ force });
  console.log("[enrich-pledges] 결과:", result);
  process.exit(0);
}

main().catch((err) => {
  console.error("[enrich-pledges] 실패:", err);
  process.exit(1);
});
