/**
 * 선관위 공식사진 일괄 동기화 스크립트
 * 5/21 후보자 등록 마감 이후 실행하면 API에 공식 사진이 반영됩니다.
 *
 * 사용법:
 *   npx tsx script/sync-nec-photos.ts
 */
import "dotenv/config";
import { syncCandidatePhotos } from "../server/nec-sync.js";

async function main() {
  console.log("===== 선관위 공식사진 동기화 시작 =====");
  try {
    const result = await syncCandidatePhotos();
    console.log("");
    console.log("=".repeat(50));
    console.log("  사진 동기화 결과");
    console.log("=".repeat(50));
    console.log(`  스캔한 API 후보수   : ${result.scanned}`);
    console.log(`  사진 업데이트 완료  : ${result.updated}`);
    console.log(`  사진 없음 (API 미제공): ${result.noPhoto}`);
    console.log(`  오류               : ${result.errors}`);
    console.log("=".repeat(50));
    process.exit(0);
  } catch (err: any) {
    console.error("===== 동기화 실패 =====");
    console.error(err.message);
    process.exit(1);
  }
}

main();
