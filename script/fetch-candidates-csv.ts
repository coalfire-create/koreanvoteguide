import axios from "axios";
import { writeFileSync } from "fs";
import * as path from "path";

const SERVICE_KEY = process.env.DATA_GO_KR_API_KEY;
const CANDIDATE_API_BASE = "https://apis.data.go.kr/9760000/PofelcddInfoInqireService";
const SG_ID_2026 = "20260603";
const SG_TYPE_CODES = ["3", "4", "5", "6", "11"];

// CSV 필드 이스케이프 함수
function escapeCsv(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function fetchAllCandidates() {
  if (!SERVICE_KEY) {
    console.error("❌ 오류: DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다.");
    process.exit(1);
  }

  console.log("=== 제9회 지방선거 전체 후보자 OpenAPI 수집 시작 ===");
  const allRows: string[] = [];

  // CSV 헤더 작성 (검증 임포터 Synonyms에 최적화)
  allRows.push("성명,생년월일,선거구,시도,정당,재산총액,병역사항,세금납부,세금체납,전과기록,공직선거경력");

  let totalCount = 0;

  for (const sgTypecode of SG_TYPE_CODES) {
    const typeLabel = getElectionTypeLabel(sgTypecode);
    console.log(`\n--- [${typeLabel} (코드: ${sgTypecode})] 수집 중 ---`);

    let pageNo = 1;
    const numOfRows = 100;

    while (true) {
      try {
        const response = await axios.get(
          `${CANDIDATE_API_BASE}/getPofelcddRegistSttusInfoInqire`,
          {
            params: {
              serviceKey: SERVICE_KEY,
              pageNo: String(pageNo),
              numOfRows: String(numOfRows),
              sgId: SG_ID_2026,
              sgTypecode,
              resultType: "json",
            },
            timeout: 30000,
          }
        );

        const body = response.data?.response?.body ?? {};
        const rawItems = body?.items?.item ?? [];
        const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

        if (items.length === 0) {
          break;
        }

        console.log(`페이지 ${pageNo}: ${items.length}건 수신`);

        for (const item of items) {
          const name = item.name ?? "";
          const birthday = item.birthday ?? "";
          const district = (item.wiwName || item.sggName || "").trim();
          const sdName = item.sdName ?? "";
          const party = item.jdName || "무소속";

          // 검증 정보는 OpenAPI에서 제공하지 않으므로 빈 값으로 설정
          const propertyAmount = "";
          const militaryService = "";
          const taxPaid = "";
          const taxArrears = "";
          const criminal = "";
          const candidacyHistory = "";

          const row = [
            escapeCsv(name),
            escapeCsv(birthday),
            escapeCsv(district),
            escapeCsv(sdName),
            escapeCsv(party),
            escapeCsv(propertyAmount),
            escapeCsv(militaryService),
            escapeCsv(taxPaid),
            escapeCsv(taxArrears),
            escapeCsv(criminal),
            escapeCsv(candidacyHistory),
          ].join(",");

          allRows.push(row);
          totalCount++;
        }

        if (items.length < numOfRows) {
          break;
        }

        pageNo++;
        // API 서버 부하 방지를 위한 슬립
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (err: any) {
        console.error(`❌ 페이지 ${pageNo} 수집 중 오류 발생: ${err.message}`);
        break;
      }
    }
  }

  const outputPath = path.join(process.cwd(), "candidates.csv");
  writeFileSync(outputPath, allRows.join("\n"), "utf-8");

  console.log("\n==================================================");
  console.log(`✅ 수집 및 CSV 생성 완료!`);
  console.log(`- 총 수집된 후보자 수: ${totalCount}명`);
  console.log(`- 저장 파일 경로: ${outputPath}`);
  console.log(`⚠️ 참고: 선관위 OpenAPI는 전과, 재산, 병역, 세금 등 민감 검증 정보를 제공하지 않습니다.`);
  console.log(`  따라서 해당 컬럼들은 빈 채로 생성되었으므로, 필요한 데이터를 채워 임포터에 사용해 주세요.`);
  console.log("==================================================");
}

function getElectionTypeLabel(code: string): string {
  const map: Record<string, string> = {
    "3": "시도지사",
    "4": "구시군의장",
    "5": "시도의원",
    "6": "구시군의원",
    "11": "교육감",
  };
  return map[code] || "기타";
}

fetchAllCandidates();
