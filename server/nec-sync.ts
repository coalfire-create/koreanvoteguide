import axios from "axios";
import { db } from "./db";
import { electionCandidates, legislators } from "../shared/schema";
import { eq } from "drizzle-orm";

const SERVICE_KEY = process.env.DATA_GO_KR_API_KEY;
// 예비후보자/후보자 정보 API (승인 완료)
const CANDIDATE_API_BASE = "https://apis.data.go.kr/9760000/PofelcddInfoInqireService";

// ============================================================
// 2026 지방선거 예비후보자 동기화 (기존 로직 유지)
// ============================================================

const SG_ID_2026 = "20260603"; // 2026년 6월 3일 지방선거

// 선거 유형 코드 (sgTypecode)
// 3: 시도지사, 4: 구시군의장, 5: 시도의원, 6: 구시군의원, 11: 교육감
const SG_TYPE_CODES = ["3", "4", "5", "6", "11"];

export async function syncElectionCandidates() {
  if (!SERVICE_KEY) {
    throw new Error("DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  console.log(`[nec-sync] 2026 지방선거(${SG_ID_2026}) 예비후보자 동기화 시작...`);

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

  const NUM_OF_ROWS = 100;
  let pageNo = 1;
  let totalSynced = 0;

  while (true) {
    let items: any[] = [];
    try {
      const response = await axios.get(
        `${CANDIDATE_API_BASE}/getPoelpcddRegistSttusInfoInqire`,
        {
          params: {
            serviceKey: SERVICE_KEY,
            pageNo: String(pageNo),
            numOfRows: String(NUM_OF_ROWS),
            sgId: SG_ID_2026,
            sgTypecode,
            resultType: "json",
          },
          timeout: 30000,
        }
      );

      const body = response.data?.response?.body ?? {};
      const rawItems = body?.items?.item ?? [];
      items = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);

      if (items.length === 0) {
        if (pageNo === 1) {
          console.log(`[nec-sync] 유형(${sgTypecode}): 데이터가 없거나 형식이 올바르지 않습니다.`);
        }
        break;
      }

      console.log(`[nec-sync] 유형(${sgTypecode}) 페이지 ${pageNo}: ${items.length}건 수신`);
    } catch (err: any) {
      console.error(`[nec-sync] 유형(${sgTypecode}) 페이지 ${pageNo} 조회 실패:`, err.message);
      break;
    }

    let synced = 0;
    for (const item of items) {
      try {
        // huboid: 후보자 ID, name: 이름, jdName: 정당명,
        // sdName: 시도명, sggName: 선거구명, wiwName: 구시군명
        // birthday: 생년월일(YYYYMMDD), gender: 성별, job: 직업,
        // edu: 학력, career1/career2: 경력
        const sourceId = String(item.huboid || (item.name + (item.birthday || "")));
        const career = [item.career1, item.career2]
          .map((c: string | undefined) => (c || "").trim())
          .filter(Boolean)
          .join("\n");
        const electionType = getElectionTypeLabel(sgTypecode);
        const districtName = (item.wiwName || item.sggName || "").trim();
        const regionCode = (item.sdName || "").trim();

        await db.insert(electionCandidates).values({
          sourceId,
          electionType,
          regionCode,
          districtName,
          name: (item.name || "").trim(),
          party: (item.jdName || "무소속").trim(),
          job: (item.job || "").trim(),
          career,
          edu: (item.edu || "").trim(),
          criminal: "",
          birthday: (item.birthday || "").trim(),
          gender: (item.gender || "").trim(),
          status: "예비후보",
          pledges: [],
        }).onConflictDoUpdate({
          target: electionCandidates.sourceId,
          set: {
            party: (item.jdName || "무소속").trim(),
            job: (item.job || "").trim(),
            career,
            edu: (item.edu || "").trim(),
            status: "예비후보",
            districtName,
          },
        });
        synced++;
      } catch (err: any) {
        console.error(`[nec-sync] 항목 저장 실패 (${item.name}):`, err.message);
      }
    }
    totalSynced += synced;

    if (items.length < NUM_OF_ROWS) break;
    pageNo++;
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`[nec-sync] 유형(${sgTypecode}) 완료: ${totalSynced}건 동기화됨`);
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

// ============================================================
// 22대 총선(2024-04-10) 현직 국회의원 학력·경력·직업 동기화
// API: WinnerInfoInqireService2 / getWinnerInfoInqire
// ============================================================

export interface NecAssemblyMemberDetail {
  name: string;       // 당선인 이름 (매핑 키)
  huboid: string;     // 선관위 후보자 ID
  education: string;  // 최종 학력 (edu 필드)
  career: string;     // 경력 (career1 + career2 줄바꿈)
  job: string;        // 직업
  district: string;   // 선거구명
  party: string;      // 정당명
  voteCount: number;  // 득표수
  voteRate: string;   // 득표율 (%)
}

// 이름 정규화: 공백 제거 후 비교
function normalizeName(name: string): string {
  return (name || "").replace(/\s+/g, "").trim();
}

/**
 * WinnerInfoInqireService2 / getWinnerInfoInqire
 * 22대 총선 당선인 정보 전체 수집 → 이름 Map 반환
 * 제공 필드: name, huboid, edu(학력), career1/2(경력), job(직업),
 *           sggName(선거구), jdName(정당), dugsu(득표수), dugyul(득표율)
 */
export async function fetchNec22ndAssemblyDetails(): Promise<Map<string, NecAssemblyMemberDetail>> {
  if (!SERVICE_KEY) throw new Error("DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다.");

  console.log("[nec-sync] 22대 총선 당선인 학력/경력 조회 시작 (WinnerInfoInqireService2)...");

  const detailMap = new Map<string, NecAssemblyMemberDetail>();
  const NUM_OF_ROWS = 100;
  let pageNo = 1;

  while (true) {
    try {
      const resp = await axios.get(
        "https://apis.data.go.kr/9760000/WinnerInfoInqireService2/getWinnerInfoInqire",
        {
          params: {
            serviceKey: SERVICE_KEY,
            pageNo: String(pageNo),
            numOfRows: String(NUM_OF_ROWS),
            sgId: "20240410",    // 22대 총선
            sgTypecode: "2",     // 2: 국회의원
            resultType: "json",
          },
          timeout: 30000,
        }
      );

      const body = resp.data?.response?.body ?? {};
      const rawItems = body?.items?.item ?? [];
      const items: any[] = Array.isArray(rawItems) ? rawItems : [rawItems];

      if (items.length === 0 || (items.length === 1 && !items[0]?.name)) break;

      for (const item of items) {
        const name = normalizeName(item.name || "");
        if (!name) continue;

        const career = [item.career1, item.career2]
          .map((c: string | undefined) => (c || "").trim())
          .filter(Boolean)
          .join("\n");

        detailMap.set(name, {
          name,
          huboid: String(item.huboid || ""),
          education: (item.edu || "").trim() || "정보 없음",
          career,
          job: (item.job || "").trim(),
          district: (item.sggName || item.wiwName || "").trim(),
          party: (item.jdName || "").trim(),
          voteCount: parseInt(String(item.dugsu || "0").replace(/,/g, ""), 10) || 0,
          voteRate: (item.dugyul || "").trim(),
        });
      }

      console.log(`[nec-sync] 페이지 ${pageNo}: ${items.length}건 (누계 ${detailMap.size}명)`);
      if (items.length < NUM_OF_ROWS) break;
      pageNo++;
      await new Promise((r) => setTimeout(r, 400));
    } catch (err: any) {
      console.error(`[nec-sync] 페이지 ${pageNo} 오류:`, err.message);
      break;
    }
  }

  console.log(`[nec-sync] 당선인 조회 완료: 총 ${detailMap.size}명`);
  return detailMap;
}

/**
 * DB legislators 테이블에 선관위 22대 총선 당선인 데이터 반영
 */
export async function syncNec22ndDetailsToLegislators(): Promise<{
  synced: number;
  notFound: string[];
  errors: string[];
}> {
  console.log("[nec-sync] 국회의원 테이블에 선관위 당선인 정보 반영 시작...");

  const errors: string[] = [];
  const notFound: string[] = [];
  let synced = 0;

  const detailMap = await fetchNec22ndAssemblyDetails();
  if (detailMap.size === 0) {
    console.warn("[nec-sync] 당선인 데이터 0건 — DB 반영 건너뜀.");
    return { synced: 0, notFound: [], errors: ["선관위 API에서 데이터를 가져오지 못했습니다."] };
  }

  const allLegislators = await db
    .select({ monaCd: legislators.monaCd, name: legislators.name })
    .from(legislators);

  for (const leg of allLegislators) {
    const detail = detailMap.get(normalizeName(leg.name));
    if (!detail) { notFound.push(leg.name); continue; }

    try {
      await db
        .update(legislators)
        .set({
          education: detail.education,
          career: detail.career || null,
          necDetailSyncedAt: new Date(),
        })
        .where(eq(legislators.monaCd, leg.monaCd));
      synced++;
    } catch (err: any) {
      errors.push(`${leg.name}: ${err.message}`);
    }
  }

  console.log(`[nec-sync] 완료: ${synced}명 갱신, 미매핑 ${notFound.length}명, 오류 ${errors.length}건`);
  if (notFound.length > 0) {
    console.log(`[nec-sync] 미매핑(${notFound.length}): ${notFound.slice(0, 15).join(", ")}${notFound.length > 15 ? " ..." : ""}`);
  }
  return { synced, notFound, errors };
}
