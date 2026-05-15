/**
 * election_candidates 테이블의 photo 컬럼을 Naver 인물 검색으로 채웁니다.
 * mock-data(mayor-candidates.ts)의 후보들도 함께 처리합니다.
 */
import "dotenv/config";
import { db } from "../server/db.js";
import { electionCandidates } from "../shared/schema.js";
import { isNull, or, eq, sql } from "drizzle-orm";
import axios from "axios";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DELAY_MS = 800;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function buildNaverPortraitUrl(uuid: string): string {
  return `https://search.pstatic.net/common?type=n&size=360x450&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2FprofileImg%2F${uuid}.jpg`;
}

async function fetchFromNaver(name: string, role?: string): Promise<string | null> {
  const queries = role
    ? [`${name} ${role}`, name]
    : [name];

  for (const query of queries) {
    try {
      const r = await axios.get("https://search.naver.com/search.naver", {
        params: { where: "nexearch", query },
        timeout: 8000,
        headers: { "User-Agent": UA },
      });
      const html: string = r.data;

      // profileImg UUID pattern
      const profileMatch = html.match(/sstatic\.naver\.net\/people\/profileImg\/([a-f0-9-]{36})\.(?:jpg|jpeg|png)/);
      if (profileMatch) {
        return buildNaverPortraitUrl(profileMatch[1]);
      }

      // Old-format /people/NN/
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
    await sleep(300);
  }
  return null;
}

async function fetchFromWikipedia(name: string): Promise<string | null> {
  const variants = [name, `${name} (정치인)`, `${name} (시장)`, `${name} (지사)`];
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

// All candidate names from mayor-candidates.ts that need photos
const MOCK_CANDIDATES = [
  { name: "오세훈", role: "서울시장" },
  { name: "정원오", role: "서울시장" },
  { name: "이상규", role: "서울시장" },
  { name: "허경영", role: "시장" },
  { name: "박형준", role: "부산시장" },
  { name: "전재수", role: "부산시장" },
  { name: "유정복", role: "인천시장" },
  { name: "박찬대", role: "인천시장" },
  { name: "김관영", role: "전북도지사" },
  { name: "서거석", role: "전북교육감" },
  { name: "홍준표", role: "대구시장" },
  { name: "권영진", role: "대구시장" },
  { name: "이재명", role: "경기도지사" },
  { name: "양향자", role: "경기도지사" },
  { name: "추미애", role: "경기도지사" },
  { name: "최기문", role: "영천시장" },
  { name: "김병삼", role: "영천시장" },
  { name: "이정훈", role: "영천시장" },
  { name: "도성훈", role: "인천시교육감" },
  { name: "이화수", role: "시장" },
  { name: "김철환", role: "시장" },
  { name: "신동헌", role: "시장" },
  { name: "안철수", role: "경기도지사" },
  { name: "김은혜", role: "경기도지사" },
  { name: "원희룡", role: "지사" },
  { name: "오영훈", role: "제주도지사" },
  { name: "부상일", role: "제주도지사" },
  { name: "민홍철", role: "국회의원" },
  { name: "최동용", role: "시장" },
  { name: "이미경", role: "구청장" },
];

async function main() {
  // 1. DB candidates without photo
  const dbRows = await db
    .select({ id: electionCandidates.id, name: electionCandidates.name, districtName: electionCandidates.districtName })
    .from(electionCandidates)
    .where(or(isNull(sql`photo`), eq(sql`photo`, "")));

  console.log(`\n[fetch-candidate-photos] DB 후보자 ${dbRows.length}명 + mock ${MOCK_CANDIDATES.length}명 처리 시작\n`);

  // Process DB candidates
  for (let i = 0; i < dbRows.length; i++) {
    const row = dbRows[i];
    process.stdout.write(`  DB [${i + 1}/${dbRows.length}] ${row.name} (${row.districtName})... `);

    let url = await fetchFromNaver(row.name, row.districtName || undefined);
    if (!url) url = await fetchFromWikipedia(row.name);

    if (url) {
      await db.execute(sql`UPDATE election_candidates SET photo = ${url} WHERE id = ${row.id}`);
      process.stdout.write(`✓\n`);
    } else {
      process.stdout.write(`✗\n`);
    }
    await sleep(DELAY_MS);
  }

  // 2. Process mock candidates (update politician_photos cache via photo-service)
  // These are stored in-memory via the photo service, so just log the results
  console.log(`\n  === Mock 후보자 Naver 조회 결과 ===\n`);
  const photoMap: Record<string, string> = {};

  for (let i = 0; i < MOCK_CANDIDATES.length; i++) {
    const c = MOCK_CANDIDATES[i];
    process.stdout.write(`  [${i + 1}/${MOCK_CANDIDATES.length}] ${c.name} (${c.role})... `);

    let url = await fetchFromNaver(c.name, c.role);
    if (!url) url = await fetchFromWikipedia(c.name) || null;

    if (url) {
      photoMap[c.name] = url;
      process.stdout.write(`✓\n`);
    } else {
      process.stdout.write(`✗\n`);
    }
    await sleep(DELAY_MS);
  }

  // Print the results to embed in politician-photos.ts
  console.log(`\n  === politician-photos.ts에 추가할 항목 ===`);
  for (const [name, url] of Object.entries(photoMap)) {
    console.log(`  "${name}": "${url}",`);
  }

  console.log(`\n[fetch-candidate-photos] 완료`);
}

main().catch(console.error).finally(() => process.exit(0));
