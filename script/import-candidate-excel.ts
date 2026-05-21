// 선관위 "후보자 명부" 엑셀(.xlsx) 일괄 import + 국회의원 누락 점검.
//
// 사용:
//   npm run import:excel                 # 프로젝트 루트의 *후보자_명부*.xlsx 전부
//   npm run import:excel -- <폴더>        # 다른 폴더 지정
//   npm run import:excel -- --dry-run     # 매칭만 검증(쓰기 없음)
//
// 동작: 시도지사 등 기존 후보는 검증정보(재산/병역/세금/전과/입후보) UPDATE,
//      DB에 없던 국회의원 재보궐 후보는 신규 INSERT. 마지막에 선관위 API(국회의원,
//      sgTypecode=2)와 대조해 엑셀이 빠진 선거구/후보(=누락)를 보고한다.

import axios from "axios";
import { importCandidateExcels, findRosterFiles } from "../server/candidate-excel-import";
import { db } from "../server/db";
import { electionCandidates } from "../shared/schema";
import { eq } from "drizzle-orm";

const SG_ID = "20260603";
const norm = (s: string) => (s || "").replace(/\s+/g, "").trim();

async function fetchAssemblyByElections() {
  const KEY = process.env.DATA_GO_KR_API_KEY;
  if (!KEY) return [];
  const out: any[] = [];
  let page = 1;
  while (true) {
    const resp = await axios.get(
      "https://apis.data.go.kr/9760000/PofelcddInfoInqireService/getPofelcddRegistSttusInfoInqire",
      { params: { serviceKey: KEY, pageNo: String(page), numOfRows: "100", sgId: SG_ID, sgTypecode: "2", resultType: "json" }, timeout: 30000 },
    );
    const raw = resp.data?.response?.body?.items?.item ?? [];
    const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (items.length === 0) break;
    out.push(...items);
    if (items.length < 100) break;
    page++;
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const dryRun = args.includes("--dry-run");
  const dir = args.find((a) => !a.startsWith("--")) || process.cwd();

  const files = findRosterFiles(dir);
  if (files.length === 0) {
    console.error(`[import:excel] '${dir}'에서 *후보자_명부*.xlsx 파일을 찾지 못했습니다.`);
    process.exit(1);
  }
  console.log(`[import:excel] 대상 파일 ${files.length}개${dryRun ? " (DRY RUN)" : ""}`);
  const result = await importCandidateExcels(files, { dryRun });
  console.log("\n[import:excel] 결과 요약:", JSON.stringify({ ...result, byFile: undefined, unmatchedSample: undefined }, null, 2));

  // ── 국회의원 누락 점검: API(14선거구) vs 엑셀 커버리지 ──
  console.log("\n" + "=".repeat(60));
  console.log("  국회의원 재보궐 누락 점검 (선관위 API 대조)");
  console.log("=".repeat(60));
  let api: any[] = [];
  try { api = await fetchAssemblyByElections(); } catch (e: any) { console.warn("  API 조회 실패:", e.message); }

  const apiByDist = new Map<string, any[]>();
  for (const it of api) {
    const d = `${it.sdName || ""} ${it.sggName || it.wiwName || ""}`.trim();
    (apiByDist.get(d) ?? apiByDist.set(d, []).get(d)!).push(it);
  }

  // DB에 적재된 국회의원 후보(이름+생일)
  const dbAssembly = await db
    .select({ name: electionCandidates.name, birthday: electionCandidates.birthday, district: electionCandidates.districtName, prop: electionCandidates.propertyAmount })
    .from(electionCandidates)
    .where(eq(electionCandidates.electionType, "국회의원"));
  const dbKey = new Set(dbAssembly.map((r) => `${norm(r.name)}_${(r.birthday || "").replace(/\D/g, "")}`));

  console.log(`  · API 국회의원 후보: ${api.length}명 / ${apiByDist.size}개 선거구`);
  console.log(`  · DB 적재 국회의원 후보: ${dbAssembly.length}명`);

  // API엔 있는데 DB에 없는 후보 = 누락
  const missing: string[] = [];
  for (const it of api) {
    const k = `${norm(it.name)}_${(it.birthday || "").replace(/\D/g, "")}`;
    if (!dbKey.has(k)) missing.push(`${it.sdName} ${it.sggName || it.wiwName} · ${it.name}`);
  }
  // 검증정보(재산) 없는 국회의원 = 엑셀 미반영
  const noVerif = dbAssembly.filter((r) => !r.prop).map((r) => `${r.district} · ${r.name}`);

  if (missing.length === 0) console.log("  ✅ API의 국회의원 후보가 모두 DB에 있습니다 (누락 없음).");
  else { console.log(`  ⚠️ DB에 없는 국회의원 후보 ${missing.length}명 (엑셀·동기화 누락):`); missing.forEach((m) => console.log(`     - ${m}`)); }

  if (noVerif.length > 0) {
    console.log(`  ⚠️ 검증정보(재산 등) 미반영 국회의원 ${noVerif.length}명 (해당 선거구 엑셀 필요):`);
    const dists = [...new Set(noVerif.map((s) => s.split(" · ")[0]))];
    dists.forEach((d) => console.log(`     - ${d}`));
  }
  console.log("=".repeat(60));
  process.exit(0);
}

main().catch((err) => { console.error("[import:excel] 실패:", err); process.exit(1); });
