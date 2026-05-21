import { readFileSync } from "fs";
import { db } from "./db";
import { electionCandidates } from "../shared/schema";
import { eq } from "drizzle-orm";

// ============================================================
// 후보자 검증정보(재산·병역·세금/체납·전과·공직선거 입후보 경력) CSV import
// ------------------------------------------------------------
// 선관위 선거통계시스템(info.nec.go.kr)에서 내려받은 후보자정보 엑셀을 CSV(UTF-8)로
// 저장한 뒤, 이름·생년월일·선거구로 election_candidates 레코드와 병합한다.
// 기본 등록 API가 제공하지 않는 항목이므로 별도 CSV가 정본(source of truth)이다.
//
// 매칭 우선순위(동명이인 안전):
//   1) 이름 + 생년월일(8자리)         — 가장 신뢰도 높음(생년월일이 동명이인 구분)
//   2) 이름 + 생년월일 + 선거구(matchKey) — 정확 일치
//   3) 이름 + 선거구(wiwName 또는 sggName)
//   4) 이름 단독 — DB에 동일 이름이 1명일 때만(그 외엔 미매칭 처리)
// ============================================================

// ─── CSV 파서 (의존성 없음, 따옴표/줄바꿈/BOM 처리) ─────────────────────────
export function parseCsv(text: string): Record<string, string>[] {
  // BOM 제거
  const clean = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else if (c === "\r") {
      // \r\n 의 \r 은 무시 (다음 \n 에서 행 종료)
    } else {
      field += c;
    }
  }
  // 마지막 필드/행 flush
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((v) => v && v.trim().length > 0)) // 빈 줄 스킵
    .map((r) => {
      const obj: Record<string, string> = {};
      header.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
      return obj;
    });
}

// ─── 컬럼명 매핑 (한글 헤더 → 내부 필드) ────────────────────────────────────
// 헤더는 공백/구두점 제거 후 부분일치로 판정 → 선관위 포맷 변형에 관대.
const COLUMN_SYNONYMS: Record<string, string[]> = {
  name:           ["성명", "이름", "후보자명", "후보명", "name"],
  birthday:       ["생년월일", "생일", "출생", "birth"],
  district:       ["선거구", "선거구명", "sgg", "wiw"],
  sdName:         ["시도", "시·도", "광역", "sd"],
  party:          ["정당", "소속정당", "jd"],
  propertyAmount: ["재산", "재산총액", "총재산", "신고재산", "재산신고"],
  militaryService:["병역", "병역사항"],
  taxPaid:        ["세금납부", "납부세금", "납세", "최근5년간납부", "납부액", "납부실적"],
  taxArrears:     ["세금체납", "체납액", "체납세금", "체납실적", "체납"],
  criminal:       ["전과", "전과기록", "범죄경력", "전과사실"],
  candidacyHistory:["공직선거경력", "입후보경력", "후보경력", "선거경력", "공직선거입후보"],
};

function normHeader(h: string): string {
  return (h || "").replace(/[\s·.()\-_/]/g, "").toLowerCase();
}

// CSV 헤더 → 내부 필드 매핑표 생성. taxArrears(체납)를 taxPaid(납부)보다 먼저 검사해
// "세금체납"이 "세금납부"로 오분류되지 않게 한다.
function buildHeaderMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const fieldOrder = [
    "name", "birthday", "district", "sdName", "party",
    "taxArrears", "taxPaid", // 체납 먼저
    "propertyAmount", "militaryService", "criminal", "candidacyHistory",
  ];
  for (const h of headers) {
    const nh = normHeader(h);
    for (const field of fieldOrder) {
      if (map[field]) continue; // 이미 매핑된 필드는 건너뜀(첫 매칭 우선)
      const hit = COLUMN_SYNONYMS[field].some((syn) => nh.includes(normHeader(syn)));
      if (hit) { map[field] = h; break; }
    }
  }
  return map;
}

function norm(s: string | null | undefined): string {
  return (s || "").replace(/\s+/g, "").trim();
}
function birth8(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "").slice(0, 8);
}

// 전과 텍스트 → JSONB 배열(문자열). 번호/줄바꿈/세미콜론 기준으로 분리.
function splitCriminal(raw: string): string[] {
  const t = (raw || "").trim();
  if (!t || /^(없음|해당없음|전과없음|-)$/.test(norm(t))) return [];
  return t
    .split(/\n|;|、|(?:\s*\d+\.\s*)|(?:\s*\d+\)\s*)/)
    .map((x) => x.trim())
    .filter((x) => x.length > 1);
}

export interface VerificationImportResult {
  csvRows: number;
  matched: number;
  unmatched: number;
  updated: number;
  errors: number;
  detectedColumns: Record<string, string>;
  unmatchedSample: string[];
}

export async function importCandidateVerification(
  csvPath: string,
  opts: { dryRun?: boolean } = {},
): Promise<VerificationImportResult> {
  const dryRun = !!opts.dryRun;
  const text = readFileSync(csvPath, "utf-8");
  const records = parseCsv(text);

  const result: VerificationImportResult = {
    csvRows: records.length,
    matched: 0,
    unmatched: 0,
    updated: 0,
    errors: 0,
    detectedColumns: {},
    unmatchedSample: [],
  };
  if (records.length === 0) {
    console.warn("[verif-import] CSV에 데이터 행이 없습니다.");
    return result;
  }

  const headerMap = buildHeaderMap(Object.keys(records[0]));
  result.detectedColumns = headerMap;
  console.log("[verif-import] 감지된 컬럼 매핑:", headerMap);
  if (!headerMap.name) {
    throw new Error("CSV에서 '성명/이름' 컬럼을 찾지 못했습니다. 헤더를 확인하세요.");
  }

  // ─── DB 후보 인덱스 구축 ───
  const rows = await db
    .select({
      id: electionCandidates.id,
      name: electionCandidates.name,
      birthday: electionCandidates.birthday,
      matchKey: electionCandidates.matchKey,
      districtName: electionCandidates.districtName,
      sggName: electionCandidates.sggName,
      wiwName: electionCandidates.wiwName,
    })
    .from(electionCandidates);

  const byNameBirth = new Map<string, string[]>();   // 이름+생일 → [id]
  const byMatchKey = new Map<string, string[]>();    // matchKey → [id]
  const byNameDistrict = new Map<string, string[]>(); // 이름+선거구 → [id]
  const byName = new Map<string, string[]>();        // 이름 → [id]
  const push = (m: Map<string, string[]>, k: string, id: string) => {
    if (!k) return;
    const arr = m.get(k) ?? []; arr.push(id); m.set(k, arr);
  };
  for (const r of rows) {
    const n = norm(r.name);
    const b = birth8(r.birthday);
    push(byName, n, r.id);
    if (b) push(byNameBirth, `${n}_${b}`, r.id);
    if (r.matchKey) push(byMatchKey, norm(r.matchKey), r.id);
    for (const d of [r.districtName, r.sggName, r.wiwName]) {
      if (d) push(byNameDistrict, `${n}_${norm(d)}`, r.id);
    }
  }

  // ─── 행별 매칭 + 업데이트 ───
  for (const rec of records) {
    const name = norm(rec[headerMap.name]);
    if (!name) { result.unmatched++; continue; }
    const b = headerMap.birthday ? birth8(rec[headerMap.birthday]) : "";
    const district = headerMap.district ? norm(rec[headerMap.district]) : "";

    // 우선순위대로 후보 id 탐색 (유일 매칭만 채택)
    const pickUnique = (ids: string[] | undefined): string | null =>
      ids && ids.length === 1 ? ids[0] : null;

    let id: string | null = null;
    if (b) id = pickUnique(byNameBirth.get(`${name}_${b}`));
    if (!id && b && district) id = pickUnique(byMatchKey.get(norm(`${name}_${b}_${district}`)));
    if (!id && district) id = pickUnique(byNameDistrict.get(`${name}_${district}`));
    if (!id) id = pickUnique(byName.get(name)); // 동명이인 없을 때만

    if (!id) {
      result.unmatched++;
      if (result.unmatchedSample.length < 30) {
        result.unmatchedSample.push(`${rec[headerMap.name]}${b ? `(${b})` : ""}${district ? `/${district}` : ""}`);
      }
      continue;
    }
    result.matched++;

    const val = (field?: string) => (field ? (rec[field] || "").trim() || null : null);
    const criminalRaw = val(headerMap.criminal);
    const update: Record<string, unknown> = {
      propertyAmount: val(headerMap.propertyAmount),
      militaryService: val(headerMap.militaryService),
      taxPaid: val(headerMap.taxPaid),
      taxArrears: val(headerMap.taxArrears),
      candidacyHistory: val(headerMap.candidacyHistory),
      verificationSyncedAt: new Date(),
    };
    if (criminalRaw !== null) {
      update.criminal = criminalRaw;
      update.criminalRecords = splitCriminal(criminalRaw);
    }
    // null만 있는(=감지된 검증 컬럼이 전부 빈) 행은 스킵
    const hasAny = Object.entries(update).some(
      ([k, v]) => k !== "verificationSyncedAt" && v !== null && !(Array.isArray(v) && v.length === 0),
    ) || criminalRaw !== null;
    if (!hasAny) continue;

    if (dryRun) { result.updated++; continue; }
    try {
      await db.update(electionCandidates).set(update).where(eq(electionCandidates.id, id));
      result.updated++;
    } catch (err: any) {
      result.errors++;
      console.error(`[verif-import] 업데이트 실패 (${name}):`, err.message);
    }
  }

  console.log(
    `[verif-import] 완료: CSV ${result.csvRows}행, 매칭 ${result.matched}, 미매칭 ${result.unmatched}, ` +
    `업데이트 ${result.updated}, 오류 ${result.errors}${dryRun ? " (DRY RUN)" : ""}`,
  );
  if (result.unmatchedSample.length > 0) {
    console.log(`[verif-import] 미매칭 샘플: ${result.unmatchedSample.join(" | ")}`);
  }
  return result;
}
