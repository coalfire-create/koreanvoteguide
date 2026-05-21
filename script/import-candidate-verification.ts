// 선관위 후보자 검증정보(재산·병역·세금/체납·전과·공직선거 입후보 경력) CSV → DB import.
//
// 사용:
//   npm run import:verification -- <csv경로>            # 실제 반영
//   npm run import:verification -- <csv경로> --dry-run   # 매칭만 검증(쓰기 없음)
//
// CSV 준비:
//   info.nec.go.kr(선거통계시스템)에서 후보자정보를 내려받아 UTF-8 CSV로 저장.
//   필수 컬럼: 성명. 권장: 생년월일, 선거구(동명이인 구분).
//   검증 컬럼(있는 만큼 자동 인식): 재산, 병역, 세금납부, 세금체납, 전과, 공직선거경력.

import { importCandidateVerification } from "../server/candidate-verification-import";

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const dryRun = args.includes("--dry-run");
  const csvPath = args.find((a) => !a.startsWith("--"));

  if (!csvPath) {
    console.error("사용법: npm run import:verification -- <csv경로> [--dry-run]");
    process.exit(1);
  }

  console.log(`[import:verification] 시작 — ${csvPath}${dryRun ? " (DRY RUN)" : ""}`);
  const result = await importCandidateVerification(csvPath, { dryRun });
  console.log("[import:verification] 결과:", JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error("[import:verification] 실패:", err);
  process.exit(1);
});
