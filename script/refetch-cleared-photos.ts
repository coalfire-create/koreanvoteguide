/**
 * photo_url이 비어있는 의원들을 Naver 인물 사진으로 재조회해 DB에 저장합니다.
 */
import "dotenv/config";
import { db } from "../server/db.js";
import { legislators } from "../shared/schema.js";
import { or, isNull, eq } from "drizzle-orm";
import axios from "axios";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DELAY_MS = 800;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function buildNaverPortraitUrl(uuid: string): string {
  return `https://search.pstatic.net/common?type=n&size=360x450&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2FprofileImg%2F${uuid}.jpg`;
}

async function fetchFromNaver(name: string): Promise<string | null> {
  const queries = [`${name} 국회의원`, name];
  for (const query of queries) {
    try {
      const r = await axios.get("https://search.naver.com/search.naver", {
        params: { where: "nexearch", query },
        timeout: 8000,
        headers: { "User-Agent": UA },
      });
      const html: string = r.data;

      const profileMatch = html.match(/sstatic\.naver\.net\/people\/profileImg\/([a-f0-9-]{36})\.(?:jpg|jpeg|png)/);
      if (profileMatch) {
        return buildNaverPortraitUrl(profileMatch[1]);
      }

      // Old-format: /people/NN/timestamp
      const typeNMatch = html.match(/search\.pstatic\.net\/common\?type=n[^"'<\s]+sstatic\.naver\.net%2Fpeople%2F[^"'<\s]*/);
      if (typeNMatch) {
        const raw = typeNMatch[0].replace(/&amp;/g, "&");
        if (!raw.includes("expire=")) {
          return `https://${raw}`;
        }
      }
    } catch {
      // ignore
    }
    await sleep(200);
  }
  return null;
}

async function fetchFromWikipedia(name: string): Promise<string | null> {
  const variants = [name, `${name} (정치인)`, `${name} (국회의원)`];
  for (const v of variants) {
    try {
      const r = await axios.get(
        `https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(v)}`,
        { timeout: 6000, headers: { "User-Agent": UA } }
      );
      const thumb = r.data?.thumbnail?.source ?? null;
      if (thumb) return thumb;
    } catch {
      // ignore
    }
  }
  return null;
}

async function main() {
  const rows = await db
    .select({ monaCd: legislators.monaCd, name: legislators.name })
    .from(legislators)
    .where(or(isNull(legislators.photoUrl), eq(legislators.photoUrl, "")));

  console.log(`\n[refetch-cleared-photos] 사진 없는 의원: ${rows.length}명\n`);

  let naverOk = 0;
  let wikiOk = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    process.stdout.write(`  [${i + 1}/${rows.length}] ${row.name}... `);

    let url = await fetchFromNaver(row.name);
    if (url) {
      naverOk++;
      process.stdout.write(`✓ Naver\n`);
    } else {
      url = await fetchFromWikipedia(row.name);
      if (url) {
        wikiOk++;
        process.stdout.write(`✓ Wikipedia\n`);
      } else {
        failed++;
        process.stdout.write(`✗ 없음\n`);
      }
    }

    if (url) {
      await db
        .update(legislators)
        .set({ photoUrl: url })
        .where(eq(legislators.monaCd, row.monaCd));
    }

    if (i + 1 < rows.length) await sleep(DELAY_MS);
  }

  console.log(`\n[refetch-cleared-photos] 완료`);
  console.log(`  Naver: ${naverOk}명`);
  console.log(`  Wikipedia: ${wikiOk}명`);
  console.log(`  실패: ${failed}명`);
}

main().catch(console.error).finally(() => process.exit(0));
