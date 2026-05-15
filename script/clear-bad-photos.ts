/**
 * Daum 뉴스/쇼핑, Kakao 썸네일 등 잘못된 photo_url을 DB에서 제거하고
 * 해당 의원들의 Wikipedia 사진을 재조회해 저장합니다.
 */
import "dotenv/config";
import { db } from "../server/db.js";
import { legislators } from "../shared/schema.js";
import { sql, like, or, isNull, eq, and, not } from "drizzle-orm";
import axios from "axios";

const UA = "KoreanVoteGuide/1.0 (admin@antigravity.kr)";
const DELAY_MS = 600;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function isBadUrl(url: string | null): boolean {
  if (!url) return false;
  return (
    url.includes("t1.daumcdn.net/news") ||
    url.includes("daumcdn.net/shophow") ||
    url.includes("shop1.daumcdn.net") ||
    url.includes("C32x32") ||
    url.includes("harmony_static") ||
    url.includes("expire=1") ||
    url.includes("kakaocdn.net/thumb")
  );
}

async function fetchFromWikipedia(name: string): Promise<string | null> {
  const variants = [name, `${name} (정치인)`, `${name} (국회의원)`];
  for (const v of variants) {
    try {
      const r = await axios.get(
        `https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(v)}`,
        { timeout: 8000, headers: { "User-Agent": UA } }
      );
      const thumb = r.data?.thumbnail?.source ?? null;
      if (thumb) return thumb;
    } catch {
      // try next
    }
  }
  return null;
}

async function main() {
  // 1. 잘못된 URL을 가진 의원 목록 조회
  const all = await db
    .select({ monaCd: legislators.monaCd, name: legislators.name, photoUrl: legislators.photoUrl })
    .from(legislators);

  const bad = all.filter(r => isBadUrl(r.photoUrl));
  console.log(`\n[clear-bad-photos] 잘못된 URL 의원: ${bad.length}명 (전체 ${all.length}명)\n`);

  let cleared = 0;
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < bad.length; i++) {
    const row = bad[i];
    const old = row.photoUrl;

    // 2. Wikipedia에서 새 사진 조회
    console.log(`  [${i + 1}/${bad.length}] ${row.name} (${row.monaCd}) 조회 중...`);
    const newUrl = await fetchFromWikipedia(row.name);

    if (newUrl) {
      await db
        .update(legislators)
        .set({ photoUrl: newUrl })
        .where(eq(legislators.monaCd, row.monaCd));
      console.log(`    ✓ Wikipedia: ${newUrl.slice(0, 80)}...`);
      updated++;
    } else {
      // Wikipedia에 없으면 URL을 비워서 dynamicFallback이 작동하게
      await db
        .update(legislators)
        .set({ photoUrl: "" })
        .where(eq(legislators.monaCd, row.monaCd));
      console.log(`    ✗ Wikipedia 없음 → URL 초기화 (컴포넌트 dynamicFallback으로 처리)`);
      cleared++;
      failed++;
    }

    if (i + 1 < bad.length) await sleep(DELAY_MS);
  }

  console.log(`\n[clear-bad-photos] 완료`);
  console.log(`  Wikipedia로 교체: ${updated}명`);
  console.log(`  URL 초기화 (fallback 대기): ${cleared}명`);
}

main().catch(console.error).finally(() => process.exit(0));
