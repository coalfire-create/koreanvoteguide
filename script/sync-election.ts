import { syncElectionCandidates } from "../server/nec-sync";

async function main() {
  console.log("===== 지방선거 데이터 동기화 시작 =====");
  try {
    await syncElectionCandidates();
    console.log("===== 모든 데이터 동기화 성공 =====");
    process.exit(0);
  } catch (err: any) {
    console.error("===== 동기화 중 오류 발생 =====");
    console.error(err.message);
    process.exit(1);
  }
}

main();
