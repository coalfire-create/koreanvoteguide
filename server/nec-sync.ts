import axios from "axios";
import { db } from "./db";
import { electionCandidates } from "../shared/schema";
import { sql, and, eq } from "drizzle-orm";

const SERVICE_KEY = process.env.DATA_GO_KR_API_KEY;
const API_BASE = "http://apis.data.go.kr/9760000/PofelcNationalCandidateService";
const SG_ID = "20260603"; // 2026년 6월 3일 지방선거

// 선거 유형 코드 (sgTypecode)
// 3: 시도지사, 4: 구시군의장, 5: 시도의원, 6: 구시군의원, 11: 교육감
const SG_TYPE_CODES = ["3", "4", "5", "6", "11"];

export async function syncElectionCandidates() {
  if (!SERVICE_KEY) {
    throw new Error("DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  console.log(`[nec-sync] 2026 지방선거(${SG_ID}) 예비후보자 동기화 시작...`);

  for (const typeCode of SG_TYPE_CODES) {
    try {
      await fetchAndSyncType(typeCode);
    } catch (error: any) {
      console.error(`[nec-sync] 유형(${typeCode}) 동기화 실패:`, error.message);
    }
  }

  console.log("[nec-sync] 모든 유형 동기화 완료");
}

async function fetchAndSyncType(sgTypecode: string) {
  console.log(`[nec-sync] 유형(${sgTypecode}) 데이터 수집 중...`);
  
  // 예비후보자 리스트 조회
  const response = await axios.get(`${API_BASE}/getPreCandidateList`, {
    params: {
      serviceKey: SERVICE_KEY,
      pageNo: "1",
      numOfRows: "1000", // 한 번에 많이 가져오기
      sgId: SG_ID,
      sgTypecode: sgTypecode,
      resultType: "json",
    },
  });

  const items = response.data?.getPreCandidateList?.item;
  if (!items || !Array.isArray(items)) {
    console.log(`[nec-sync] 유형(${sgTypecode}): 데이터가 없거나 형식이 올바르지 않습니다.`);
    return;
  }

  console.log(`[nec-sync] 유형(${sgTypecode}): ${items.length}건 수신`);

  let synced = 0;
  for (const item of items) {
    try {
      // API 필드 매핑
      // HUBID: 후보자 ID
      // NAME: 이름, PARTYNAME: 정당명, SIDONAME: 시도명, GUSIGUNNAME: 구시군명, SGGNAME: 선거구명
      // BIRTHDAY: 생년월일(YYYYMMDD), GENDER: 성별, JOB: 직업, EDU: 학력, CAREER1/2: 경력, CRIM: 전과
      
      const sourceId = String(item.HUBID || item.NAME + item.BIRTHDAY);
      const career = [item.CAREER1, item.CAREER2].filter(Boolean).join("\n");
      const electionType = getElectionTypeLabel(sgTypecode);
      
      await db.insert(electionCandidates).values({
        sourceId,
        electionType,
        regionCode: item.SIDONAME || "",
        districtName: item.GUSIGUNNAME || item.SGGNAME || "",
        name: item.NAME || "",
        party: item.PARTYNAME || "무소속",
        job: item.JOB || "",
        career,
        edu: item.EDU || "",
        criminal: item.CRIM || "",
        birthday: item.BIRTHDAY || "",
        gender: item.GENDER || "",
        status: "예비후보",
        pledges: [], // 공약은 별도 API 필요
      }).onConflictDoUpdate({
        target: electionCandidates.sourceId,
        set: {
          party: item.PARTYNAME || "무소속",
          job: item.JOB || "",
          career,
          edu: item.EDU || "",
          criminal: item.CRIM || "",
          status: "예비후보",
          districtName: item.GUSIGUNNAME || item.SGGNAME || "",
        }
      });
      synced++;
    } catch (err: any) {
      console.error(`[nec-sync] 항목 저상 실패 (${item.NAME}):`, err.message);
    }
  }

  console.log(`[nec-sync] 유형(${sgTypecode}) 완료: ${synced}건 동기화됨`);
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
