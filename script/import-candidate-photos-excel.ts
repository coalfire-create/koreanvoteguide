// 선관위 "후보자 명부" 엑셀에 박힌 후보 사진을 추출해 election_candidates.photo 에 반영.
// 기본은 국회의원선거 파일만(요청). --all 주면 모든 명부 파일.
//
// 사용:
//   npm run import:photos                # 국회의원 파일만
//   npm run import:photos -- --all       # 전체 명부(시도지사 등 포함)
//   npm run import:photos -- <폴더>

import { writeFileSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { extractRosterPhotos, findRosterFiles } from "../server/candidate-excel-import";
import { db } from "../server/db";
import { electionCandidates } from "../shared/schema";
import { and, eq } from "drizzle-orm";

const norm = (s: string) => (s || "").replace(/\s+/g, "").trim();
const birth8 = (s: string | null | undefined) => (s || "").replace(/\D/g, "").slice(0, 8);
const OUT_DIR = join(process.cwd(), "server/static/uploads/candidate-photos");

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const all = args.includes("--all");
  const dir = args.find((a) => !a.startsWith("--")) || process.cwd();

  let files = findRosterFiles(dir);
  if (!all) files = files.filter((f) => basename(f).normalize("NFC").includes("국회의원선거"));
  if (files.length === 0) { console.error(`[import:photos] 대상 파일 없음 (${dir})`); process.exit(1); }
  console.log(`[import:photos] 대상 파일 ${files.length}개${all ? " (전체)" : " (국회의원)"}`);

  mkdirSync(OUT_DIR, { recursive: true });

  // DB 인덱스: 이름+생일 → {id} (국회의원 우선, --all이면 전체)
  const rows = await db
    .select({ id: electionCandidates.id, name: electionCandidates.name, birthday: electionCandidates.birthday, etype: electionCandidates.electionType })
    .from(electionCandidates);
  const byNameBirth = new Map<string, { id: string }[]>();
  const byName = new Map<string, { id: string }[]>();
  for (const r of rows) {
    const nb = `${norm(r.name)}_${birth8(r.birthday)}`;
    (byNameBirth.get(nb) ?? byNameBirth.set(nb, []).get(nb)!).push({ id: r.id });
    const n = norm(r.name);
    (byName.get(n) ?? byName.set(n, []).get(n)!).push({ id: r.id });
  }

  let extracted = 0, saved = 0, unmatched = 0;
  const unmatchedSample: string[] = [];
  for (const file of files) {
    const photos = extractRosterPhotos(file);
    extracted += photos.length;
    for (const ph of photos) {
      const nb = `${norm(ph.name)}_${ph.birthday}`;
      let hit = ph.birthday && byNameBirth.get(nb)?.length === 1 ? byNameBirth.get(nb)![0] : null;
      if (!hit && byName.get(norm(ph.name))?.length === 1) hit = byName.get(norm(ph.name))![0];
      if (!hit) {
        unmatched++;
        if (unmatchedSample.length < 30) unmatchedSample.push(`${ph.name}(${ph.birthday})/${ph.district}`);
        continue;
      }
      const fname = `${hit.id}.${ph.ext}`;
      writeFileSync(join(OUT_DIR, fname), ph.buffer);
      await db.update(electionCandidates).set({ photo: `/uploads/candidate-photos/${fname}` }).where(eq(electionCandidates.id, hit.id));
      saved++;
    }
    console.log(`  · ${basename(file).normalize("NFC").replace(/^.*명부/, "")} → 사진 ${photos.length}개`);
  }

  console.log(`\n[import:photos] 완료: 추출 ${extracted}, 저장/반영 ${saved}, 미매칭 ${unmatched}`);
  if (unmatchedSample.length) console.log(`[import:photos] 미매칭: ${unmatchedSample.join(" | ")}`);
  process.exit(0);
}

main().catch((e) => { console.error("[import:photos] 실패:", e); process.exit(1); });
