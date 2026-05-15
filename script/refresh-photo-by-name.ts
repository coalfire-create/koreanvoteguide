/**
 * 특정 이름들의 사진을 강제로 재조회합니다 (동명이인·잘못된 매핑 정정용).
 *
 * 사용:
 *   npx tsx script/refresh-photo-by-name.ts 황희
 *   npx tsx script/refresh-photo-by-name.ts 황희 김XX 박YY
 *
 * 동작:
 *   1) legislators.photoUrl을 NULL로 비움
 *   2) politicianPhotoCache의 해당 이름 row 삭제
 *   3) Naver 검색을 정당명 컨텍스트로 재실행 → profileImg UUID 추출 → 새 URL 저장
 *   4) 못 찾으면 Wikipedia "{name} (정치인)" / "(국회의원)" / 평문 순서로 폴백
 *
 * 주의: politician-photos.ts 하드코딩 맵에 있는 이름은 클라이언트가 그 URL을 우선시함.
 *   하드코딩에 박힌 항목은 이 스크립트 결과와 무관 (의도된 override).
 */
import "dotenv/config";
import { db } from "../server/db.js";
import { legislators, politicianPhotoCache } from "../shared/schema.js";
import { eq, inArray } from "drizzle-orm";
import axios from "axios";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DELAY_MS = 800;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function buildNaverPortraitUrl(uuid: string): string {
  return `https://search.pstatic.net/common?type=n&size=360x450&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2FprofileImg%2F${uuid}.jpg`;
}

async function fetchNaverProfile(query: string): Promise<string | null> {
  try {
    const r = await axios.get("https://search.naver.com/search.naver", {
      params: { where: "nexearch", query },
      timeout: 9000,
      headers: { "User-Agent": UA },
    });
    const html: string = r.data;
    const m = html.match(/sstatic\.naver\.net\/people\/profileImg\/([a-f0-9-]{36})\.(?:jpg|jpeg|png)/);
    if (m) return buildNaverPortraitUrl(m[1]);
  } catch {
    // ignore
  }
  return null;
}

async function fetchWikipedia(name: string): Promise<string | null> {
  // (정치인)/(국회의원) disambiguation 페이지를 먼저 시도 — 동명이인 충돌 회피의 핵심.
  const variants = [`${name} (정치인)`, `${name} (국회의원)`, name];
  for (const v of variants) {
    try {
      const r = await axios.get(
        `https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(v)}`,
        { timeout: 7000, headers: { "User-Agent": UA } },
      );
      const thumb = r.data?.thumbnail?.source ?? null;
      if (thumb) return thumb;
    } catch {
      // try next
    }
  }
  return null;
}

async function resolveSafePhoto(name: string, party: string | null): Promise<{ url: string | null; source: string }> {
  // 가장 disambiguating한 쿼리부터: "이름 정당 국회의원" → "이름 국회의원" → "이름 의원"
  const queries: string[] = [];
  if (party) queries.push(`${name} ${party} 국회의원`);
  queries.push(`${name} 국회의원`, `${name} 의원`);

  for (const q of queries) {
    const u = await fetchNaverProfile(q);
    if (u) return { url: u, source: `Naver(${q})` };
    await sleep(250);
  }

  const wiki = await fetchWikipedia(name);
  if (wiki) return { url: wiki, source: "Wikipedia" };

  return { url: null, source: "(none)" };
}

async function main() {
  const names = process.argv.slice(2).map((s) => s.trim()).filter(Boolean);
  if (names.length === 0) {
    console.error("사용법: npx tsx script/refresh-photo-by-name.ts 황희 [김XX 박YY ...]");
    process.exit(1);
  }

  console.log(`\n[refresh-photo-by-name] 대상: ${names.join(", ")} (${names.length}명)\n`);

  // 0) 대상 의원 조회 — DB에 없는 이름은 경고만 출력
  const rows = await db
    .select({ monaCd: legislators.monaCd, name: legislators.name, party: legislators.party })
    .from(legislators)
    .where(inArray(legislators.name, names));

  const found = new Set(rows.map((r) => r.name));
  for (const n of names) {
    if (!found.has(n)) console.warn(`  ⚠ ${n}: legislators 테이블에서 못 찾음 (스킵)`);
  }

  if (rows.length === 0) {
    console.log("[refresh-photo-by-name] 처리할 의원이 없습니다. 종료.");
    return;
  }

  // 1) 캐시 무효화 — politicianPhotoCache(서버 메모리/디스크)
  try {
    await db.delete(politicianPhotoCache).where(inArray(politicianPhotoCache.name, names));
    console.log(`  🧹 politicianPhotoCache: ${names.length}건 삭제`);
  } catch (e) {
    console.warn(`  ⚠ politicianPhotoCache 삭제 실패: ${(e as Error).message}`);
  }

  // 2) 의원별로 재조회 → DB 업데이트
  let okNaver = 0;
  let okWiki = 0;
  let cleared = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    process.stdout.write(`  [${i + 1}/${rows.length}] ${row.name.padEnd(6)} (${row.party ?? "-"}) ... `);

    const { url, source } = await resolveSafePhoto(row.name, row.party ?? null);

    if (url) {
      await db
        .update(legislators)
        .set({ photoUrl: url })
        .where(eq(legislators.monaCd, row.monaCd));
      if (source.startsWith("Naver")) okNaver++;
      else okWiki++;
      process.stdout.write(`✓ ${source}\n    ${url.slice(0, 90)}${url.length > 90 ? "…" : ""}\n`);
    } else {
      // 빈 문자열로 → 클라이언트가 하드코딩 맵 / dynamic fallback 사용
      await db
        .update(legislators)
        .set({ photoUrl: "" })
        .where(eq(legislators.monaCd, row.monaCd));
      cleared++;
      process.stdout.write(`✗ 검색 실패 → photo_url=NULL (하드코딩/fallback 대기)\n`);
    }

    if (i + 1 < rows.length) await sleep(DELAY_MS);
  }

  console.log(`\n[refresh-photo-by-name] 완료`);
  console.log(`  ✓ Naver profileImg: ${okNaver}명`);
  console.log(`  ✓ Wikipedia: ${okWiki}명`);
  console.log(`  ✗ 비움: ${cleared}명`);
}

main()
  .catch((e) => {
    console.error("[refresh-photo-by-name] 치명적 오류:", e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
