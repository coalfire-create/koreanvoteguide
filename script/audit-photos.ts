/** 사진 데이터 출처별 분포 감사 (읽기 전용). 실행: tsx --env-file=.env script/audit-photos.ts */
import { db } from "../server/db.js";
import { legislators, electionCandidates, politicianPhotoCache } from "../shared/schema.js";

function classify(url: string | null | undefined): string {
  if (!url) return "(없음)";
  if (url.includes("open.assembly.go.kr") || url.includes("assembly.go.kr")) return "국회공식";
  if (url.includes("info.nec.go.kr")) return "선관위공식";
  if (url.includes("pstatic.net") || url.includes("naver.net")) return "네이버크롤(동명이인위험)";
  if (url.includes("wikimedia.org") || url.includes("wikipedia")) return "위키(동명이인위험)";
  return "기타";
}

async function main() {
  const legs = await db.select({ name: legislators.name, photoUrl: legislators.photoUrl }).from(legislators);
  const cands = await db.select({ name: electionCandidates.name, party: electionCandidates.party, photo: electionCandidates.photo }).from(electionCandidates);
  const cache = await db.select({ name: politicianPhotoCache.name, photoUrl: politicianPhotoCache.photoUrl }).from(politicianPhotoCache);

  const tally = (rows: { url: string | null | undefined }[]) => {
    const m: Record<string, number> = {};
    for (const r of rows) m[classify(r.url)] = (m[classify(r.url)] ?? 0) + 1;
    return m;
  };

  console.log(`\n===== 국회의원 ${legs.length}명 사진 출처 =====`);
  console.table(tally(legs.map((l) => ({ url: l.photoUrl }))));

  console.log(`\n===== 선거 후보자 ${cands.length}명 사진 출처 =====`);
  console.table(tally(cands.map((c) => ({ url: c.photo }))));

  const nullCandidates = cands.filter((c) => !c.photo);
  console.log(`\n공식 사진 없는 후보자 ${nullCandidates.length}명 → 네이버 이름검색 폴백 (동명이인 오류 위험)`);

  console.log(`\n===== politician_photo_cache ${cache.length}건 (네이버/위키 크롤 결과) =====`);
  console.table(tally(cache.map((c) => ({ url: c.photoUrl }))));
  const nullCache = cache.filter((c) => !c.photoUrl).length;
  console.log(`사진 못 찾음(null) 캐시: ${nullCache}건`);
  console.log(`context 없는(동명이인 미구분) 캐시 키: ${cache.filter((c) => !c.name.includes("::")).length}건`);
  console.log(`context 있는(동명이인 구분) 캐시 키: ${cache.filter((c) => c.name.includes("::")).length}건`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
