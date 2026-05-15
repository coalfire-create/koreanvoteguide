/**
 * NEC API 디버그 스크립트
 * 1) API 연결 확인
 * 2) sgId / sgTypecode 파라미터 검증
 * 3) 실제 반환되는 데이터 확인
 */
import axios from "axios";

const SERVICE_KEY = process.env.DATA_GO_KR_API_KEY;
const CANDIDATE_API_BASE = "https://apis.data.go.kr/9760000/PofelcddInfoInqireService";

// 테스트할 sgId 값들
const SG_IDS_TO_TEST = ["20260603"];
const SG_TYPE_CODES = ["3", "4", "5", "6", "11"];

async function testApi() {
  console.log("=== NEC API 디버그 시작 ===");
  console.log(`SERVICE_KEY 존재: ${!!SERVICE_KEY}`);
  console.log(`SERVICE_KEY 길이: ${SERVICE_KEY?.length}`);
  console.log(`SERVICE_KEY 값 (앞 10자): ${SERVICE_KEY?.slice(0, 10)}...`);
  console.log("");

  for (const sgId of SG_IDS_TO_TEST) {
    for (const sgTypecode of SG_TYPE_CODES) {
      const url = `${CANDIDATE_API_BASE}/getPoelpcddRegistSttusInfoInqire`;
      const params = {
        serviceKey: SERVICE_KEY,
        pageNo: "1",
        numOfRows: "10",
        sgId,
        sgTypecode,
        resultType: "json",
      };
      console.log(`\n--- 테스트: sgId=${sgId}, sgTypecode=${sgTypecode} ---`);
      console.log(`URL: ${url}`);
      console.log(`Params:`, JSON.stringify(params, null, 2));

      try {
        const response = await axios.get(url, { params, timeout: 15000 });
        const data = response.data;
        
        // 전체 응답 구조 확인
        console.log(`HTTP Status: ${response.status}`);
        console.log(`Response type: ${typeof data}`);
        
        if (typeof data === "string") {
          // XML 응답일 수 있음 (에러 시 XML로 반환)
          console.log(`⚠️ 문자열 응답 (XML?): ${data.slice(0, 500)}`);
          continue;
        }

        const header = data?.response?.header;
        const body = data?.response?.body;
        
        console.log(`Header resultCode: ${header?.resultCode}`);
        console.log(`Header resultMsg: ${header?.resultMsg}`);
        console.log(`Body totalCount: ${body?.totalCount}`);
        console.log(`Body numOfRows: ${body?.numOfRows}`);
        console.log(`Body pageNo: ${body?.pageNo}`);
        
        const rawItems = body?.items?.item ?? [];
        const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
        console.log(`Items count: ${items.length}`);
        
        if (items.length > 0) {
          console.log(`✅ 데이터 발견! 첫 번째 항목 키: ${Object.keys(items[0]).join(", ")}`);
          console.log(`✅ 첫 번째 항목 샘플:`);
          console.log(JSON.stringify(items[0], null, 2));
        } else {
          console.log(`❌ 데이터 없음 (items.length = 0)`);
        }
      } catch (err: any) {
        console.error(`❌ 요청 실패: ${err.message}`);
        if (err.response) {
          console.error(`  Status: ${err.response.status}`);
          console.error(`  Data: ${JSON.stringify(err.response.data)?.slice(0, 500)}`);
        }
      }
    }
  }

  // DB 카운트 확인
  console.log("\n\n=== DB 상태 확인 ===");
  try {
    const { db } = await import("../server/db");
    const { electionCandidates } = await import("../shared/schema");
    const { sql } = await import("drizzle-orm");
    
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(electionCandidates);
    console.log(`election_candidates 테이블 총 행 수: ${countResult[0]?.count}`);
    
    // 유형별 카운트
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
  } catch (err: any) {
    console.error(`DB 조회 실패: ${err.message}`);
  }

  console.log("\n=== 디버그 완료 ===");
  process.exit(0);
}

testApi();
