import { readFileSync, readdirSync, mkdtempSync, rmSync } from "fs";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { join, basename } from "path";
import { XMLParser } from "fast-xml-parser";
import { db } from "./db";
import { electionCandidates } from "../shared/schema";
import { eq } from "drizzle-orm";

// ============================================================
// 선관위 선거통계시스템 "후보자 명부" 엑셀(.xlsx) import
// ------------------------------------------------------------
// 파일 1개 = 선거종류+지역 1개. 컬럼(A~R):
//   A 선거구명 · C 기호 · D 소속정당명 · E 성명(한자) · F 성별 · G 생년월일(연령)
//   H 주소 · I 직업 · J 학력 · K 경력 · L 재산신고액(천원) · M 병역신고사항
//   N 납세 납부액(천원) · O 최근5년간 체납액 · P 현 체납액 · Q 전과기록 유무(건수) · R 입후보횟수
// 기본정보(정당/직업/학력/경력)는 이미 API로 적재됨 → 여기서는 검증정보를 덮어쓰고,
// DB에 없던 후보(국회의원 재보궐 등)는 신규 insert 한다.
// 매칭: 이름 + 생년월일(8자리) (유일 매칭만 채택).
// ============================================================

const SG_ID = "20260603";

// xlsx 1장(첫 워크시트)을 [열문자→값] 행 배열로 로드 (unzip + fast-xml-parser, 무의존성)
export function loadXlsxGrid(xlsxPath: string): Record<string, string>[] {
  const dir = mkdtempSync(join(tmpdir(), "xlsx-"));
  try {
    execSync(`unzip -o -q "${xlsxPath}" -d "${dir}"`);
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

    // shared strings
    let strings: string[] = [];
    try {
      const ssDoc = parser.parse(readFileSync(join(dir, "xl/sharedStrings.xml"), "utf8"));
      let si = ssDoc.sst?.si ?? [];
      if (!Array.isArray(si)) si = [si];
      strings = si.map((x: any) => {
        if (x.t !== undefined) return typeof x.t === "object" ? (x.t["#text"] ?? "") : String(x.t);
        if (x.r) {
          const rs = Array.isArray(x.r) ? x.r : [x.r];
          return rs.map((y: any) => (typeof y.t === "object" ? (y.t["#text"] ?? "") : String(y.t ?? ""))).join("");
        }
        return "";
      });
    } catch { /* sharedStrings 없을 수 있음 */ }

    // 첫 워크시트 파일 찾기
    const wsDir = join(dir, "xl/worksheets");
    const wsFile = readdirSync(wsDir).find((f) => /\.xml$/i.test(f));
    if (!wsFile) return [];
    const doc = parser.parse(readFileSync(join(wsDir, wsFile), "utf8"));
    let rows = doc.worksheet?.sheetData?.row ?? [];
    if (!Array.isArray(rows)) rows = [rows];

    return rows.map((row: any) => {
      let cells = row.c ?? [];
      if (!Array.isArray(cells)) cells = [cells];
      const obj: Record<string, string> = {};
      for (const c of cells) {
        const col = String(c["@_r"] || "").replace(/[0-9]/g, "");
        let v: any = c.v;
        if (v && typeof v === "object") v = v["#text"];
        if (c["@_t"] === "s") v = strings[parseInt(v, 10)] ?? "";
        if (c["@_t"] === "inlineStr") v = c.is?.t ?? "";
        obj[col] = v == null ? "" : String(v);
      }
      return obj;
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ─── 파일명에서 선거종류 + 시도 추출 ───
// 예: ...명부[국회의원선거][경기도][평택시을].xlsx / ...명부[시·도지사선거][서울특별시].xlsx
const ELECTION_TYPE_FROM_FILE: Record<string, string> = {
  "국회의원선거": "국회의원",
  "시·도지사선거": "시도지사",
  "시도지사선거": "시도지사",
  "구·시·군의장선거": "구시군의장",
  "교육감선거": "교육감",
  "시·도의원선거": "시도의원",
  "구·시·군의원선거": "구시군의원",
};
function parseFileName(file: string): { electionType: string | null; sdName: string | null; sgg: string | null } {
  // macOS는 한글 파일명을 NFD(분해형)로 저장 → NFC로 정규화해야 문자열/키 비교가 맞는다.
  const name = basename(file).normalize("NFC");
  const brackets = (name.match(/\[([^\[\]]+)\]/g) || []).map((b) => b.slice(1, -1));
  // 첫 두 개([제9회...], [후보자 명부]는 파일명에 없음) — 실제로는 [선거종류][시도]([선거구]) 순
  let electionType: string | null = null;
  let sd: string | null = null;
  let sgg: string | null = null;
  for (const b of brackets) {
    if (!electionType && ELECTION_TYPE_FROM_FILE[b]) { electionType = ELECTION_TYPE_FROM_FILE[b]; continue; }
    if (electionType && !sd) { sd = b; continue; }
    if (electionType && sd && !sgg) { sgg = b; continue; }
  }
  return { electionType, sdName: sd, sgg };
}

// ─── 값 정규화 헬퍼 ───
const norm = (s: string | null | undefined) => (s || "").replace(/\s+/g, "").trim();
const birth8 = (s: string | null | undefined) => (s || "").replace(/\D/g, "").slice(0, 8);

function fmtWon(won: number): string {
  if (won === 0) return "0원";
  const neg = won < 0;
  let v = Math.abs(won);
  const eok = Math.floor(v / 100000000);
  const man = Math.floor((v % 100000000) / 10000);
  let s = "";
  if (eok > 0) s += `${eok.toLocaleString()}억 `;
  if (man > 0) s += `${man.toLocaleString()}만원`;
  else if (eok > 0) s = s.trim();
  else s = `${v.toLocaleString()}원`;
  return (neg ? "-" : "") + s.trim();
}
// "1,823,897"(천원) → "18억 2,389만원"
function fmtCheonwon(raw: string): string | null {
  const n = parseInt(String(raw).replace(/[^0-9-]/g, ""), 10);
  if (isNaN(n)) return null;
  return fmtWon(n * 1000);
}

export interface ExcelCandidate {
  district: string;     // 선거구명 (A)
  party: string;
  name: string;
  hanja: string | null;
  gender: string | null;
  birthday: string;     // YYYYMMDD
  job: string | null;
  edu: string | null;
  career: string | null;
  propertyAmount: string | null;
  militaryService: string | null;
  taxPaid: string | null;
  taxArrears: string | null;
  criminal: string | null;
  candidacyHistory: string | null;
  electionType: string;
  sdName: string;
}

// 한 파일 → 후보 레코드 배열
export function parseCandidateRoster(xlsxPath: string): ExcelCandidate[] {
  const grid = loadXlsxGrid(xlsxPath);
  const { electionType, sdName, sgg } = parseFileName(xlsxPath);

  // 헤더 행 = "성명" 포함 셀이 있는 행. 그 다음 행은 하위헤더(납부액/체납액).
  let headerIdx = grid.findIndex((row) => Object.values(row).some((v) => norm(v).includes("성명")));
  if (headerIdx < 0) return [];
  const head = grid[headerIdx];
  const sub = grid[headerIdx + 1] || {};

  // 열문자 → 필드 매핑 (상위+하위 헤더 결합 후 부분일치)
  const colField: Record<string, string> = {};
  const allCols = new Set([...Object.keys(head), ...Object.keys(sub)]);
  for (const col of allCols) {
    const label = norm(`${head[col] || ""}${sub[col] || ""}`);
    if (!label) continue;
    if (label.includes("선거구")) colField[col] = "district";
    else if (label.includes("정당")) colField[col] = "party";
    else if (label.includes("성명")) colField[col] = "name";
    else if (label.includes("성별")) colField[col] = "gender";
    else if (label.includes("생년월일")) colField[col] = "birthday";
    else if (label.includes("직업")) colField[col] = "job";
    else if (label.includes("학력")) colField[col] = "edu";
    else if (label.includes("경력")) colField[col] = "career";
    else if (label.includes("재산")) colField[col] = "property";
    else if (label.includes("병역")) colField[col] = "military";
    else if (label.includes("납부")) colField[col] = "taxPaid";
    else if (label.includes("5년") && label.includes("체납")) colField[col] = "tax5yr";
    else if (label.includes("체납")) colField[col] = "taxCur";
    else if (label.includes("전과")) colField[col] = "criminal";
    else if (label.includes("입후보") || label.includes("횟수")) colField[col] = "candidacy";
  }
  const colOf = (field: string) => Object.keys(colField).find((c) => colField[c] === field);
  const nameCol = colOf("name");
  if (!nameCol) return [];

  const out: ExcelCandidate[] = [];
  for (let i = headerIdx + 2; i < grid.length; i++) {
    const row = grid[i];
    const get = (field: string) => { const c = colOf(field); return c ? (row[c] || "").trim() : ""; };
    const rawName = (row[nameCol] || "").trim();
    if (!rawName || norm(rawName).includes("성명")) continue;

    const nameParts = rawName.split(/\s*[(（]/);
    const name = nameParts[0].trim();
    const hanja = nameParts[1] ? nameParts[1].replace(/[)）]/g, "").trim() : null;
    if (!name) continue;

    const bd = birth8(get("birthday"));
    const tax5 = get("tax5yr");
    const taxC = get("taxCur");
    const arrears5 = tax5 ? fmtCheonwon(tax5) : null;
    const arrearsC = taxC ? fmtCheonwon(taxC) : null;
    const isZero = (s: string) => parseInt(String(s).replace(/[^0-9-]/g, ""), 10) === 0;
    let taxArrears: string | null;
    if ((!tax5 || isZero(tax5)) && (!taxC || isZero(taxC))) taxArrears = "없음";
    else taxArrears = [arrears5 && `최근5년 ${arrears5}`, arrearsC && `현재 ${arrearsC}`].filter(Boolean).join(" / ") || null;

    const candCount = get("candidacy");
    const propRaw = get("property");
    const taxPaidRaw = get("taxPaid");

    out.push({
      district: get("district") || sgg || sdName || "",
      party: get("party") || "무소속",
      name,
      hanja,
      gender: get("gender") || null,
      birthday: bd,
      job: get("job") || null,
      edu: get("edu") || null,
      career: get("career") || null,
      propertyAmount: propRaw ? fmtCheonwon(propRaw) : null,
      militaryService: get("military") || null,
      taxPaid: taxPaidRaw ? fmtCheonwon(taxPaidRaw) : null,
      taxArrears,
      criminal: get("criminal") || null,
      candidacyHistory: candCount ? `입후보 ${candCount}` : null,
      electionType: electionType || "기타",
      sdName: sdName || "",
    });
  }
  return out;
}

function splitCriminal(raw: string | null): string[] {
  const t = (raw || "").trim();
  if (!t || /^(없음|해당없음|전과없음|0건|-)$/.test(norm(t))) return [];
  // 선관위 명부는 건수만 제공(상세 없음) → "N건 (상세 미공개)"
  const m = norm(t).match(/(\d+)건/);
  if (m) return [`전과 ${m[1]}건 (상세는 선거공보 참고)`];
  return [t];
}

export interface ExcelImportResult {
  files: number;
  totalRows: number;
  updated: number;
  inserted: number;
  unmatched: number;
  errors: number;
  byFile: Record<string, { rows: number; updated: number; inserted: number; unmatched: number; type: string }>;
  unmatchedSample: string[];
}

export async function importCandidateExcels(
  files: string[],
  opts: { dryRun?: boolean } = {},
): Promise<ExcelImportResult> {
  const dryRun = !!opts.dryRun;
  const result: ExcelImportResult = {
    files: 0, totalRows: 0, updated: 0, inserted: 0, unmatched: 0, errors: 0,
    byFile: {}, unmatchedSample: [],
  };

  // DB 인덱스: 이름+생일 → [id]
  const rows = await db
    .select({ id: electionCandidates.id, name: electionCandidates.name, birthday: electionCandidates.birthday })
    .from(electionCandidates);
  const byNameBirth = new Map<string, string[]>();
  for (const r of rows) {
    const k = `${norm(r.name)}_${birth8(r.birthday)}`;
    const arr = byNameBirth.get(k) ?? []; arr.push(r.id); byNameBirth.set(k, arr);
  }

  for (const file of files) {
    result.files++;
    const label = basename(file);
    let records: ExcelCandidate[];
    try {
      records = parseCandidateRoster(file);
    } catch (err: any) {
      result.errors++;
      console.error(`[excel-import] 파싱 실패 ${label}:`, err.message);
      continue;
    }
    const fileStat = { rows: records.length, updated: 0, inserted: 0, unmatched: 0, type: records[0]?.electionType ?? "?" };

    for (const rec of records) {
      result.totalRows++;
      const verif: Record<string, unknown> = {
        propertyAmount: rec.propertyAmount,
        militaryService: rec.militaryService,
        taxPaid: rec.taxPaid,
        taxArrears: rec.taxArrears,
        candidacyHistory: rec.candidacyHistory,
        criminal: rec.criminal,
        criminalRecords: splitCriminal(rec.criminal),
        verificationSyncedAt: new Date(),
      };

      const ids = rec.birthday ? byNameBirth.get(`${norm(rec.name)}_${rec.birthday}`) : undefined;
      const id = ids && ids.length === 1 ? ids[0] : null;

      if (id) {
        if (!dryRun) {
          try {
            await db.update(electionCandidates).set({
              ...verif,
              // 한자/기본정보가 비어있으면 보강
              hanjaName: rec.hanja ?? undefined,
            }).where(eq(electionCandidates.id, id));
          } catch (err: any) { result.errors++; console.error(`[excel-import] update 실패 (${rec.name}):`, err.message); continue; }
        }
        result.updated++; fileStat.updated++;
      } else if (rec.electionType === "국회의원" && rec.birthday) {
        // DB에 없는 국회의원 재보궐 후보 → 신규 insert
        if (!dryRun) {
          try {
            await db.insert(electionCandidates).values({
              sourceId: `${SG_ID}_2_${norm(rec.name)}_${rec.birthday}`,
              electionType: "국회의원",
              regionCode: rec.sdName,
              districtName: rec.district,
              name: rec.name,
              hanjaName: rec.hanja,
              party: rec.party,
              job: rec.job,
              career: rec.career,
              edu: rec.edu,
              birthday: rec.birthday,
              gender: rec.gender,
              status: "후보",
              candidateStatus: "등록",
              sdName: rec.sdName,
              sggName: rec.district,
              wiwName: rec.district,
              matchKey: `${norm(rec.name)}_${rec.birthday}_${norm(rec.district)}`,
              pledges: [],
              ...verif,
            } as any);
          } catch (err: any) { result.errors++; console.error(`[excel-import] insert 실패 (${rec.name}):`, err.message); continue; }
        }
        result.inserted++; fileStat.inserted++;
        // 같은 파일 내 동일인 재삽입 방지용 인덱스 갱신
        byNameBirth.set(`${norm(rec.name)}_${rec.birthday}`, ["__inserted__"]);
      } else {
        result.unmatched++; fileStat.unmatched++;
        if (result.unmatchedSample.length < 40)
          result.unmatchedSample.push(`${rec.name}(${rec.birthday})/${rec.district}/${rec.electionType}`);
      }
    }
    result.byFile[label] = fileStat;
    console.log(`[excel-import] ${label} [${fileStat.type}]: rows=${fileStat.rows} 갱신=${fileStat.updated} 신규=${fileStat.inserted} 미매칭=${fileStat.unmatched}`);
  }

  console.log(`[excel-import] 완료: 파일 ${result.files}, 행 ${result.totalRows}, 갱신 ${result.updated}, 신규 ${result.inserted}, 미매칭 ${result.unmatched}, 오류 ${result.errors}${dryRun ? " (DRY RUN)" : ""}`);
  if (result.unmatchedSample.length) console.log(`[excel-import] 미매칭 샘플: ${result.unmatchedSample.join(" | ")}`);
  return result;
}

// 디렉토리에서 "후보자 명부" 엑셀 전부 찾기
export function findRosterFiles(dir: string): string[] {
  return readdirSync(dir)
    // macOS NFD 파일명 대응 — NFC 정규화 후 매칭
    .filter((f) => /\.xlsx$/i.test(f) && f.normalize("NFC").includes("후보자_명부"))
    .map((f) => join(dir, f));
}
