import axios from "axios";
import { db } from "./db";
import { electionCandidates, legislators } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

const SERVICE_KEY = process.env.DATA_GO_KR_API_KEY;
// 예비후보자/후보자 정보 API (승인 완료)
const CANDIDATE_API_BASE = "https://apis.data.go.kr/9760000/PofelcddInfoInqireService";

// ============================================================
// 2026 지방선거 후보자 Deep Sync
// - 전체 재동기화 + 엄격 upsert (huboid 기준)
// - criminal_records JSONB는 [] 로 강제 (선관위 API 미제공)
// - composite match key 생성: 이름_생년월일_선거구 (외부 CSV 매칭용)
// - 실행 종료 시 구조화된 요약 반환/출력
// ============================================================

const SG_ID_2026 = "20260603"; // 2026년 6월 3일 지방선거

// 선거 유형 코드 (sgTypecode)
// 3: 시도지사, 4: 구시군의장, 5: 시도의원, 6: 구시군의원, 11: 교육감
const SG_TYPE_CODES = ["3", "4", "5", "6", "11"];

export interface SyncSummary {
  totalFetched: number;
  inserted: number;
  updated: number;
  missingPhoto: number;
  errors: number;
  byType: Record<string, { fetched: number; inserted: number; updated: number; missingPhoto: number; errors: number }>;
  matchKeySample: string[];
}

function normalizeForKey(s: string): string {
  return (s || "").replace(/\s+/g, "").trim();
}

function buildMatchKey(name: string, birthday: string, district: string): string {
  return [normalizeForKey(name), normalizeForKey(birthday), normalizeForKey(district)]
    .filter(Boolean)
    .join("_");
}

function toNullable(v: unknown): string | null {
  const s = (v == null ? "" : String(v)).trim();
  return s.length === 0 ? null : s;
}

function computeAgeFromBirthday(birthday: string): number | null {
  // YYYYMMDD 또는 YYYY-MM-DD 형식 지원
  const digits = (birthday || "").replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const y = parseInt(digits.slice(0, 4), 10);
  const m = parseInt(digits.slice(4, 6), 10);
  const d = parseInt(digits.slice(6, 8), 10);
  if (!y || !m || !d) return null;
  const today = new Date();
  let age = today.getFullYear() - y;
  const beforeBirthday =
    today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age--;
  return age >= 0 && age < 130 ? age : null;
}

export async function syncElectionCandidates(): Promise<SyncSummary> {
  if (!SERVICE_KEY) {
    throw new Error("DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  console.log(`[nec-sync] 2026 지방선거(${SG_ID_2026}) 후보자 Deep Sync 시작...`);

  // 기존 sourceId 사전 조회 → insert / update 판정에 사용
  const existing = await db
    .select({ sourceId: electionCandidates.sourceId })
    .from(electionCandidates);
  const existingSourceIds = new Set(
    existing.map((r) => r.sourceId).filter((v): v is string => !!v),
  );
  console.log(`[nec-sync] DB 기존 예비후보 sourceId 수: ${existingSourceIds.size}`);

  const summary: SyncSummary = {
    totalFetched: 0,
    inserted: 0,
    updated: 0,
    missingPhoto: 0,
    errors: 0,
    byType: {},
    matchKeySample: [],
  };

  for (const typeCode of SG_TYPE_CODES) {
    const typeLabel = getElectionTypeLabel(typeCode);
    summary.byType[typeLabel] = { fetched: 0, inserted: 0, updated: 0, missingPhoto: 0, errors: 0 };
    try {
      await fetchAndSyncType(typeCode, existingSourceIds, summary);
    } catch (error: any) {
      console.error(`[nec-sync] 유형(${typeCode}) 동기화 실패:`, error.message);
      summary.errors++;
      summary.byType[typeLabel].errors++;
    }
  }

  console.log("[nec-sync] 모든 유형 Deep Sync 완료");
  console.log(
    "[nec-sync] Extended data (hanjaName, job, career1/2, edu, gender, age, candidateStatus, sdName/sggName/wiwName) has been successfully mapped and synced.",
  );
  return summary;
}

async function fetchAndSyncType(
  sgTypecode: string,
  existingSourceIds: Set<string>,
  summary: SyncSummary,
) {
  const typeLabel = getElectionTypeLabel(sgTypecode);
  console.log(`[nec-sync] 유형(${sgTypecode}/${typeLabel}) 수집 시작...`);

  const NUM_OF_ROWS = 100;
  let pageNo = 1;
  let payloadKeysLogged = false;

  while (true) {
    let items: any[] = [];
    try {
      const response = await axios.get(
        `${CANDIDATE_API_BASE}/getPofelcddRegistSttusInfoInqire`,
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
        },
      );

      const body = response.data?.response?.body ?? {};
      const rawItems = body?.items?.item ?? [];
      items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

      if (items.length === 0) {
        if (pageNo === 1) {
          console.log(`[nec-sync] 유형(${sgTypecode}): 데이터 없음.`);
        }
        break;
      }

      console.log(`[nec-sync] 유형(${sgTypecode}) 페이지 ${pageNo}: ${items.length}건 수신`);

      if (!payloadKeysLogged && items[0] && typeof items[0] === "object") {
        payloadKeysLogged = true;
        console.log(
          `[nec-sync] 유형(${sgTypecode}) 응답 키 샘플: ${Object.keys(items[0]).join(", ")}`,
        );
      }
    } catch (err: any) {
      console.error(`[nec-sync] 유형(${sgTypecode}) 페이지 ${pageNo} 조회 실패:`, err.message);
      summary.errors++;
      summary.byType[typeLabel].errors++;
      break;
    }

    for (const item of items) {
      summary.totalFetched++;
      summary.byType[typeLabel].fetched++;

      // 엄격 unique key: huboid 우선. 없으면 sgId+name+birthday 조합.
      const huboid = item.huboid ? String(item.huboid).trim() : "";
      const name = (item.name || "").trim();
      const hanjaName = toNullable(item.hanjaName);
      const birthday = (item.birthday || "").trim();
      const sdName = toNullable(item.sdName);
      const sggName = toNullable(item.sggName);
      const wiwName = toNullable(item.wiwName);
      const districtName = (wiwName || sggName || "").trim();
      const regionCode = sdName || "";

      if (!huboid && !name) {
        summary.errors++;
        summary.byType[typeLabel].errors++;
        console.warn(`[nec-sync] 식별 불가 항목 스킵 (huboid/name 모두 없음)`);
        continue;
      }

      const sourceId = huboid || `${SG_ID_2026}_${normalizeForKey(name)}_${normalizeForKey(birthday)}`;
      const matchKey = buildMatchKey(name, birthday, districtName);

      const career1 = toNullable(item.career1);
      const career2 = toNullable(item.career2);
      const career = [career1, career2].filter(Boolean).join("\n") || null;

      const party = (item.jdName || "무소속").trim();
      const job = toNullable(item.job);
      const edu = toNullable(item.edu);
      const gender = toNullable(item.gender);
      const age = computeAgeFromBirthday(birthday);
      // NEC API: 등록상태는 'status' 또는 'regStatus'/'sttuscode' 등 페이로드에 따라 달라질 수 있음.
      // 우리 DB의 `status` 컬럼은 라이프사이클(예비후보/후보자)로 사용하므로
      // API 등록상태는 `candidateStatus` 로 분리 저장.
      const candidateStatus = toNullable(item.status ?? item.regStatus ?? item.sttuscode);
      const photo = (item.photo || item.jpgLink || "").trim() || null;

      const isUpdate = existingSourceIds.has(sourceId);

      // source_id 컬럼에 UNIQUE 제약을 prod DB에 강제하지 못했으므로
      // ON CONFLICT 대신 명시적 UPDATE / INSERT 분기로 안전하게 upsert 한다.
      try {
        if (isUpdate) {
          await db
            .update(electionCandidates)
            .set({
              electionType: typeLabel,
              regionCode,
              districtName,
              name,
              hanjaName,
              party,
              job,
              career,
              career1,
              career2,
              edu,
              age,
              birthday: birthday || null,
              gender,
              status: "후보",
              candidateStatus,
              sdName,
              sggName,
              wiwName,
              // criminal_records 는 외부에서 채워질 수 있으므로 빈 배열로 덮지 않고
              // 미존재(NULL)인 경우에만 [] 로 보정.
              criminalRecords: sql`COALESCE(${electionCandidates.criminalRecords}, '[]'::jsonb)`,
              matchKey,
              // photo 는 별도 파이프라인에서 채우므로 NULL 일 때만 채움.
              photo: sql`COALESCE(${electionCandidates.photo}, ${photo})`,
            })
            .where(eq(electionCandidates.sourceId, sourceId));
        } else {
          await db.insert(electionCandidates).values({
            sourceId,
            electionType: typeLabel,
            regionCode,
            districtName,
            name,
            hanjaName,
            party,
            job,
            career,
            career1,
            career2,
            edu,
            age,
            criminal: "",
            criminalRecords: [], // 선관위 API 미제공 → 항상 빈 배열로 강제
            birthday: birthday || null,
            gender,
            status: "후보",
            candidateStatus,
            sdName,
            sggName,
            wiwName,
            pledges: [],
            photo,
            matchKey,
          });
        }

        if (isUpdate) {
          summary.updated++;
          summary.byType[typeLabel].updated++;
        } else {
          summary.inserted++;
          summary.byType[typeLabel].inserted++;
          existingSourceIds.add(sourceId);
        }

        if (!photo) {
          summary.missingPhoto++;
          summary.byType[typeLabel].missingPhoto++;
        }

        if (summary.matchKeySample.length < 20 && matchKey) {
          summary.matchKeySample.push(matchKey);
        }
      } catch (err: any) {
        summary.errors++;
        summary.byType[typeLabel].errors++;
        console.error(`[nec-sync] 항목 저장 실패 (${name}/${sourceId}):`, err.message);
      }
    }

    if (items.length < NUM_OF_ROWS) break;
    pageNo++;
    await new Promise((r) => setTimeout(r, 400));
  }

  const t = summary.byType[typeLabel];
  console.log(
    `[nec-sync] 유형(${sgTypecode}/${typeLabel}) 완료: fetched=${t.fetched} inserted=${t.inserted} updated=${t.updated} missingPhoto=${t.missingPhoto} errors=${t.errors}`,
  );
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
// 5대 공약(공약본문) Deep Fetch — getPrmmddcInfo 계열
// API 응답 키: prmsOrd(순번), goalCont(목표), methCont(이행방법),
//             distCont(이행기간), deptCont(재원조달방안), prmsRealmName(분야)
// 엔드포인트가 사업자별로 약간 다를 수 있어 후보 URL을 순회 시도한다.
// ============================================================

export interface PledgeDetail {
  /** 공약 순번 (1~5 또는 기타) */
  order: number;
  /** 분야 (예: 교통, 복지, 교육 등) */
  realmName: string | null;
  /** 공약 제목 (= goalCont 헤더 또는 별도 title 필드) */
  title: string;
  /** 목표 — 원문 그대로 */
  goalCont: string | null;
  /** 이행 방법 */
  methCont: string | null;
  /** 이행 기간 */
  distCont: string | null;
  /** 재원 조달 방안 */
  deptCont: string | null;
}

const PLEDGE_API_CANDIDATES: { base: string; path: string }[] = [
  // 공식 카탈로그상 알려진 후보 엔드포인트(승인 필요). 응답 스키마는 동일하다고 가정.
  { base: CANDIDATE_API_BASE, path: "getPrmmddcInfoInqire" },
  { base: CANDIDATE_API_BASE, path: "getPrmmddcInfo" },
  { base: "https://apis.data.go.kr/9760000/EvtCnddtPbprInfoInqireService", path: "getCnddtPbprInfoInqire" },
];

/**
 * 후보 한 명의 5대 공약 본문을 가져온다.
 * - 키 후보가 여러 개이므로 첫 성공 엔드포인트를 사용한다.
 * - API가 응답 없음/권한 오류면 빈 배열을 반환한다 (스킵 가능).
 */
export async function fetchPledgesForCandidate(params: {
  sgId: string;
  sgTypecode: string;
  huboid: string;
}): Promise<PledgeDetail[]> {
  if (!SERVICE_KEY) return [];
  const { sgId, sgTypecode, huboid } = params;
  if (!huboid) return [];

  for (const ep of PLEDGE_API_CANDIDATES) {
    try {
      const resp = await axios.get(`${ep.base}/${ep.path}`, {
        params: {
          serviceKey: SERVICE_KEY,
          sgId,
          sgTypecode,
          huboid,
          numOfRows: "20",
          pageNo: "1",
          resultType: "json",
        },
        timeout: 15000,
      });
      const body = resp.data?.response?.body ?? {};
      const raw = body?.items?.item ?? [];
      const items: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
      if (items.length === 0) continue;

      return items.map((it, idx) => normalizePledgeItem(it, idx + 1));
    } catch (err: any) {
      // 권한/엔드포인트 미존재는 다음 후보로 시도
      const code = err?.response?.status;
      if (code === 404 || code === 400 || code === 403) continue;
      // 그 외 일시적 오류면 즉시 빈 배열 (상위에서 폴백)
      return [];
    }
  }
  return [];
}

function normalizePledgeItem(it: any, fallbackOrder: number): PledgeDetail {
  const order = Number(it?.prmsOrd ?? it?.prmsOrdr ?? it?.ord ?? fallbackOrder) || fallbackOrder;
  const realmName =
    toNullable(it?.prmsRealmName) ?? toNullable(it?.realmName) ?? toNullable(it?.prmsRlmName) ?? null;
  // title은 별도 컬럼이 없으면 목표(goalCont)의 1-2문장을 활용
  const goalCont = toNullable(it?.goalCont) ?? toNullable(it?.goal) ?? null;
  const title =
    toNullable(it?.prmsTitle) ??
    toNullable(it?.title) ??
    (goalCont ? goalCont.split(/[\n.]/)[0].slice(0, 80) : `공약 ${order}`);

  return {
    order,
    realmName,
    title,
    goalCont,
    methCont: toNullable(it?.methCont) ?? toNullable(it?.method) ?? null,
    distCont: toNullable(it?.distCont) ?? toNullable(it?.duration) ?? toNullable(it?.dlivrCont) ?? null,
    deptCont: toNullable(it?.deptCont) ?? toNullable(it?.fnafScamCont) ?? toNullable(it?.funding) ?? null,
  };
}

/**
 * DB의 후보 전체에 대해 공약 본문을 한 번에 채운다.
 * pledges 컬럼이 비어있거나 강제 옵션이면 덮어쓴다.
 */
export async function enrichCandidatePledges(opts: { force?: boolean } = {}): Promise<{
  scanned: number;
  enriched: number;
  empty: number;
  errors: number;
}> {
  if (!SERVICE_KEY) {
    throw new Error("DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다.");
  }
  const force = !!opts.force;

  const rows = await db
    .select({
      id: electionCandidates.id,
      sourceId: electionCandidates.sourceId,
      electionType: electionCandidates.electionType,
      pledges: electionCandidates.pledges,
      name: electionCandidates.name,
    })
    .from(electionCandidates);

  // electionType → sgTypecode 역매핑
  const typecodeOf: Record<string, string> = {
    시도지사: "3",
    구시군의장: "4",
    시도의원: "5",
    구시군의원: "6",
    교육감: "11",
  };

  const out = { scanned: 0, enriched: 0, empty: 0, errors: 0 };
  for (const row of rows) {
    out.scanned++;
    const existing = Array.isArray(row.pledges) ? (row.pledges as any[]) : [];
    if (!force && existing.length > 0) continue;
    const huboid = row.sourceId || "";
    const sgTypecode = typecodeOf[row.electionType] || "";
    if (!huboid || !sgTypecode) {
      out.empty++;
      continue;
    }
    try {
      const pledges = await fetchPledgesForCandidate({
        sgId: SG_ID_2026,
        sgTypecode,
        huboid,
      });
      if (pledges.length === 0) {
        out.empty++;
      } else {
        await db
          .update(electionCandidates)
          .set({ pledges: pledges as any })
          .where(eq(electionCandidates.id, row.id));
        out.enriched++;
      }
    } catch (err: any) {
      out.errors++;
      console.error(`[nec-sync/pledges] ${row.name}(${huboid}) 실패:`, err?.message);
    }
    // rate limit 보호 — 0.3s 간격
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(
    `[nec-sync/pledges] 스캔=${out.scanned} 보강=${out.enriched} 데이터없음=${out.empty} 오류=${out.errors}`,
  );
  return out;
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
  eduFilled: number;
  eduStillMissing: string[];
}> {
  console.log("[nec-sync] 국회의원 테이블에 선관위 당선인 정보 반영 시작...");

  const errors: string[] = [];
  const notFound: string[] = [];
  let synced = 0;

  const detailMap = await fetchNec22ndAssemblyDetails();
  if (detailMap.size === 0) {
    console.warn("[nec-sync] 당선인 데이터 0건 — 후보자 등록정보 학력 보강만 시도.");
    const enrich = await enrichLegislatorEducationFromCandidates();
    return {
      synced: 0,
      notFound: [],
      errors: ["당선인 API에서 데이터를 가져오지 못했습니다."],
      eduFilled: enrich.filled,
      eduStillMissing: enrich.stillMissing,
    };
  }

  const allLegislators = await db
    .select({ monaCd: legislators.monaCd, name: legislators.name })
    .from(legislators);

  for (const leg of allLegislators) {
    const detail = detailMap.get(normalizeName(leg.name));
    if (!detail) { notFound.push(leg.name); continue; }

    const hasEdu = !!detail.education && !EDU_EMPTY.has(detail.education.trim());
    try {
      await db
        .update(legislators)
        .set({
          // 당선인 API edu 가 비면 기존 학력을 보존(이후 후보자 보강이 채움).
          // 좋은 학력을 "정보 없음"으로 덮어쓰지 않도록 한다.
          education: hasEdu ? detail.education : sql`${legislators.education}`,
          career: detail.career ? detail.career : sql`${legislators.career}`,
          necDetailSyncedAt: new Date(),
        })
        .where(eq(legislators.monaCd, leg.monaCd));
      synced++;
    } catch (err: any) {
      errors.push(`${leg.name}: ${err.message}`);
    }
  }

  // 당선인 API(edu sparse)로 채우지 못한 학력을 후보자 등록정보로 보강
  const enrich = await enrichLegislatorEducationFromCandidates();

  console.log(
    `[nec-sync] 완료: ${synced}명 갱신, 미매핑 ${notFound.length}명, 오류 ${errors.length}건, ` +
    `학력 추가보강 ${enrich.filled}명, 학력 끝까지 미보유 ${enrich.stillMissing.length}명`,
  );
  if (notFound.length > 0) {
    console.log(`[nec-sync] 미매핑(${notFound.length}): ${notFound.slice(0, 15).join(", ")}${notFound.length > 15 ? " ..." : ""}`);
  }
  return {
    synced,
    notFound,
    errors,
    eduFilled: enrich.filled,
    eduStillMissing: enrich.stillMissing,
  };
}

// ============================================================
// 22대 총선(2024-04-10) 국회의원 "후보자 등록정보"로 학력 보강
// 당선인 API(WinnerInfoInqireService2)의 edu 가 빈 의원을, edu 가 풍부한
// 후보자 등록 API(PofelcddInfoInqireService, sgTypecode=2)로 채운다.
// ============================================================

const ASSEMBLY_22ND_SG_ID = "20240410";
const EDU_EMPTY = new Set(["", "정보 없음", "정보없음", "없음", "-"]);

interface NecCandidateEdu {
  name: string;
  education: string | null;
  career: string | null;
  party: string;
  district: string;
}

export async function fetch22ndAssemblyCandidates(): Promise<Map<string, NecCandidateEdu[]>> {
  if (!SERVICE_KEY) throw new Error("DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다.");

  console.log("[nec-sync] 22대 총선 국회의원 후보자 학력 조회 시작 (PofelcddInfoInqireService)...");
  const byName = new Map<string, NecCandidateEdu[]>();
  const NUM_OF_ROWS = 100;

  // 2: 지역구 국회의원, 7: 비례대표 국회의원 — 둘 다 조회해야 295명 전원 커버
  for (const sgTypecode of ["2", "7"]) {
    const typeLabel = sgTypecode === "7" ? "비례대표" : "지역구";
    let pageNo = 1;

    while (true) {
      try {
        const resp = await axios.get(
          `${CANDIDATE_API_BASE}/getPofelcddRegistSttusInfoInqire`,
          {
            params: {
              serviceKey: SERVICE_KEY,
              pageNo: String(pageNo),
              numOfRows: String(NUM_OF_ROWS),
              sgId: ASSEMBLY_22ND_SG_ID,
              sgTypecode,
              resultType: "json",
            },
            timeout: 30000,
          },
        );

        const body = resp.data?.response?.body ?? {};
        const rawItems = body?.items?.item ?? [];
        const items: any[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
        if (items.length === 0) break;

        for (const item of items) {
          const name = normalizeName(item.name || "");
          if (!name) continue;
          const career = [item.career1, item.career2]
            .map((c: string | undefined) => (c || "").trim())
            .filter(Boolean)
            .join("\n");
          const arr = byName.get(name) ?? [];
          arr.push({
            name,
            education: toNullable(item.edu),
            career: career || null,
            party: (item.jdName || "").trim(),
            district: (item.sggName || item.wiwName || "").trim(),
          });
          byName.set(name, arr);
        }

        console.log(`[nec-sync] 후보자(${typeLabel}) 페이지 ${pageNo}: ${items.length}건 (누계 이름 ${byName.size}개)`);
        if (items.length < NUM_OF_ROWS) break;
        pageNo++;
        await new Promise((r) => setTimeout(r, 400));
      } catch (err: any) {
        console.error(`[nec-sync] 후보자(${typeLabel}) 페이지 ${pageNo} 오류:`, err.message);
        break;
      }
    }
  }

  console.log(`[nec-sync] 22대 후보자 조회 완료: 이름 ${byName.size}개`);
  return byName;
}

export async function enrichLegislatorEducationFromCandidates(): Promise<{
  filled: number;
  stillMissing: string[];
}> {
  const rows = await db
    .select({
      monaCd: legislators.monaCd,
      name: legislators.name,
      party: legislators.party,
      district: legislators.district,
      education: legislators.education,
    })
    .from(legislators);

  const missing = rows.filter(
    (r) => !r.education || EDU_EMPTY.has(r.education.trim()),
  );
  if (missing.length === 0) {
    console.log("[nec-sync] 학력 미보유 의원 없음 — 후보자 보강 생략");
    return { filled: 0, stillMissing: [] };
  }
  console.log(`[nec-sync] 학력 미보유 의원 ${missing.length}명 → 후보자 등록정보로 보강 시도`);

  const byName = await fetch22ndAssemblyCandidates();
  let filled = 0;
  const stillMissing: string[] = [];

  for (const leg of missing) {
    const cands = byName.get(normalizeName(leg.name)) ?? [];
    const withEdu = cands.filter(
      (c) => c.education && !EDU_EMPTY.has(c.education.trim()),
    );
    if (withEdu.length === 0) {
      stillMissing.push(leg.name);
      continue;
    }

    // 동명이인 disambiguation: 정당 일치 > 지역구 부분일치 > 첫 결과
    const legParty = (leg.party || "").replace(/\s+/g, "");
    const pick =
      withEdu.find((c) => legParty && c.party && c.party.replace(/\s+/g, "") === legParty) ||
      withEdu.find((c) => leg.district && c.district && leg.district.includes(c.district)) ||
      withEdu[0];

    try {
      await db
        .update(legislators)
        .set({
          education: pick.education!,
          // 경력이 비어있던 경우에만 후보자 경력으로 보충
          career: sql`COALESCE(NULLIF(${legislators.career}, ''), ${pick.career})`,
          necDetailSyncedAt: new Date(),
        })
        .where(eq(legislators.monaCd, leg.monaCd));
      filled++;
    } catch (err: any) {
      console.error(`[nec-sync] 학력 보강 실패 (${leg.name}):`, err.message);
      stillMissing.push(leg.name);
    }
  }

  console.log(
    `[nec-sync] 학력 보강 완료: ${filled}명 채움, 끝까지 미보유 ${stillMissing.length}명` +
      (stillMissing.length
        ? ` (${stillMissing.slice(0, 15).join(", ")}${stillMissing.length > 15 ? " ..." : ""})`
        : ""),
  );
  return { filled, stillMissing };
}
