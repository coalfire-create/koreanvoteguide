/**
 * 잘못 매핑된 의원 사진을 정리하고 Naver 신형(profileImg UUID)로 재조회합니다.
 *
 * 대상:
 *   1) 같은 photo_url을 두 명 이상이 공유하는 그룹 (동명이인 잘못 매핑 의심)
 *   2) 구형 Naver /people/NN/ 포맷 (안정성 낮음 → profileImg 포맷으로 교체 시도)
 *
 * 처리:
 *   - DB의 photo_url을 일단 NULL로 비우고
 *   - Naver 인물 검색에서 "{name} 국회의원" + "{name} 의원 {selectName}" 등 정확한
 *     쿼리로 profileImg UUID를 우선 추출. 못 찾으면 Wikipedia 폴백, 모두 실패 시 NULL 유지.
 *   - politicianPhotoCache(서버 캐시)도 함께 무효화.
 */
import "dotenv/config";
import { db } from "../server/db.js";
import { legislators, politicianPhotoCache } from "../shared/schema.js";
import { eq, inArray } from "drizzle-orm";
import axios from "axios";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DELAY_MS = 900;

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
    const m = html.match(
      /sstatic\.naver\.net\/people\/profileImg\/([a-f0-9-]{36})\.(?:jpg|jpeg|png)/
    );
    if (m) return buildNaverPortraitUrl(m[1]);
  } catch {
    // ignore
  }
  return null;
}

async function fetchWikipedia(name: string): Promise<string | null> {
  const variants = [`${name} (정치인)`, `${name} (국회의원)`, name];
  for (const v of variants) {
    try {
      const r = await axios.get(
        `https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(v)}`,
        { timeout: 7000, headers: { "User-Agent": UA } }
      );
      const thumb = r.data?.thumbnail?.source ?? null;
      if (thumb) return thumb;
    } catch {
      // ignore
    }
  }
  return null;
}

async function resolveSafePhoto(
  name: string,
  party: string | null,
): Promise<string | null> {
  // 정당명 포함 쿼리가 동명이인 구분에 가장 효과적
  const queries = [
    party ? `${name} ${party} 국회의원` : null,
    `${name} 국회의원`,
    `${name} 의원`,
  ].filter(Boolean) as string[];

  for (const q of queries) {
    const u = await fetchNaverProfile(q);
    if (u) return u;
    await sleep(250);
  }
  return fetchWikipedia(name);
}

async function clearServerPhotoCache(names: string[]) {
  if (!names.length) return;
  try {
    await db.delete(politicianPhotoCache).where(inArray(politicianPhotoCache.name, names));
    console.log(`  🧹 politicianPhotoCache ${names.length}건 무효화`);
  } catch (e) {
    console.warn(`  ⚠ politicianPhotoCache 무효화 실패: ${(e as Error).message}`);
  }
}

async function main() {
  const all = await db
    .select({
      monaCd: legislators.monaCd,
      name: legislators.name,
      party: legislators.party,
      photoUrl: legislators.photoUrl,
    })
    .from(legislators);

  // ── 1) 중복 그룹 찾기 ──────────────────────────────────────
  const urlToRows = new Map<string, typeof all>();
  for (const r of all) {
    if (!r.photoUrl) continue;
    const arr = urlToRows.get(r.photoUrl) ?? [];
    arr.push(r);
    urlToRows.set(r.photoUrl, arr);
  }
  const dupRows = [...urlToRows.values()]
    .filter((rows) => rows.length > 1)
    .flat();

  // ── 2) 구형 Naver 포맷 (UUID 없는 /people/NN/) ──────────────
  const oldFormat = all.filter((r) => {
    const u = r.photoUrl ?? "";
    return u.includes("search.pstatic.net") && !u.includes("profileImg");
  });

  // ── 합치고 중복 제거 ────────────────────────────────────────
  const targetMap = new Map<string, (typeof all)[number]>();
  for (const r of [...dupRows, ...oldFormat]) {
    targetMap.set(r.monaCd, r);
  }
  const targets = [...targetMap.values()];

  console.log(`\n[fix-wrong-photos] 처리 대상: ${targets.length}명`);
  console.log(`  - 중복 매핑: ${dupRows.length}명`);
  console.log(`  - 구형 Naver: ${oldFormat.length}명`);
  console.log("");

  // 서버 사진 캐시도 미리 무효화
  await clearServerPhotoCache(targets.map((r) => r.name));

  let okNaver = 0;
  let okWiki = 0;
  let cleared = 0;

  for (let i = 0; i < targets.length; i++) {
    const row = targets[i];
    process.stdout.write(
      `  [${i + 1}/${targets.length}] ${row.name.padEnd(5)} (${row.party ?? "-"}) ... `
    );

    const newUrl = await resolveSafePhoto(row.name, row.party ?? null);

    if (newUrl) {
      const isNaver = newUrl.includes("profileImg");
      await db
        .update(legislators)
        .set({ photoUrl: newUrl })
        .where(eq(legislators.monaCd, row.monaCd));
      if (isNaver) {
        okNaver++;
        process.stdout.write(`✓ Naver profileImg\n`);
      } else {
        okWiki++;
        process.stdout.write(`✓ Wikipedia\n`);
      }
    } else {
      // 못 찾으면 일단 비워서 클라이언트 dynamicFallback이 작동하도록
      await db
        .update(legislators)
        .set({ photoUrl: "" })
        .where(eq(legislators.monaCd, row.monaCd));
      cleared++;
      process.stdout.write(`✗ → 빈 값(fallback 대기)\n`);
    }

    if (i + 1 < targets.length) await sleep(DELAY_MS);
  }

  console.log(`\n[fix-wrong-photos] 완료`);
  console.log(`  Naver profileImg 신규: ${okNaver}명`);
  console.log(`  Wikipedia 폴백: ${okWiki}명`);
  console.log(`  비움(클라 fallback): ${cleared}명`);
}

main().catch(console.error).finally(() => process.exit(0));
