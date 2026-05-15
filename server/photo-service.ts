import axios from "axios";
import { db } from "./db";
import { politicianPhotoCache } from "@shared/schema";
import { eq } from "drizzle-orm";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일 (DB 캐시)
const MEM_CACHE_TTL_MS = 60 * 60 * 1000;       // 1시간 (인메모리)

interface CacheEntry {
  url: string | null;
  fetchedAt: number;
}

// 인메모리 캐시 (빠른 응답)
const cache = new Map<string, CacheEntry>();

// DB에서 사진 URL 조회
async function getFromDb(name: string): Promise<string | null | undefined> {
  try {
    const rows = await db.select().from(politicianPhotoCache).where(eq(politicianPhotoCache.name, name)).limit(1);
    if (rows.length === 0) return undefined; // DB에 없음
    const row = rows[0];
    const age = Date.now() - row.fetchedAt.getTime();
    if (age > CACHE_TTL_MS) return undefined; // 만료
    return row.photoUrl; // null이면 "사진 없음" 확인된 것
  } catch {
    return undefined;
  }
}

// DB에 사진 URL 저장
async function saveToDb(name: string, photoUrl: string | null): Promise<void> {
  try {
    await db.insert(politicianPhotoCache).values({ name, photoUrl, fetchedAt: new Date() })
      .onConflictDoUpdate({ target: politicianPhotoCache.name, set: { photoUrl, fetchedAt: new Date() } });
  } catch {
    // 저장 실패해도 서비스는 계속
  }
}

// Extract stable Naver portrait URL from profileImg pattern
function buildNaverPortraitUrl(uuid: string): string {
  return `https://search.pstatic.net/common?type=n&size=360x450&quality=100&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2FprofileImg%2F${uuid}.jpg`;
}

async function fetchFromNaver(name: string, context?: string): Promise<string | null> {
  const queries = context
    ? [`${name} ${context}`, name]
    : [name];

  for (const query of queries) {
    try {
      const r = await axios.get("https://search.naver.com/search.naver", {
        params: { where: "nexearch", query },
        timeout: 8000,
        headers: { "User-Agent": UA },
      });
      const html: string = r.data;

      // Extract profileImg UUID — new-format portrait photo
      const profileMatch = html.match(/sstatic\.naver\.net\/people\/profileImg\/([a-f0-9-]{36})\.(?:jpg|jpeg|png)/);
      if (profileMatch) {
        return buildNaverPortraitUrl(profileMatch[1]);
      }

      // type=n (portrait type) from pstatic — captures both /profileImg/ and /people/NN/ paths
      const typeNMatch = html.match(/search\.pstatic\.net\/common\?type=n[^"'<\s]+sstatic\.naver\.net%2Fpeople%2F[^"'<\s]*/);
      if (typeNMatch) {
        const raw = typeNMatch[0].replace(/&amp;/g, "&");
        // Skip URLs with expire= parameter as they may become invalid
        if (!raw.includes("expire=")) {
          return `https://${raw}`;
        }
      }
    } catch {
      // try next query
    }
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
      // try next
    }
  }
  return null;
}

export async function getPoliticianPhotoUrl(name: string, context?: string): Promise<string | null> {
  const cacheKey = context ? `${name}::${context}` : name;

  // 1. 인메모리 캐시 확인 (가장 빠름)
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < MEM_CACHE_TTL_MS) {
    return cached.url;
  }

  // 2. DB 캐시 확인 (서버 재시작 후에도 유지)
  const dbCached = await getFromDb(name);
  if (dbCached !== undefined) {
    cache.set(cacheKey, { url: dbCached, fetchedAt: Date.now() });
    return dbCached;
  }

  // 3. 네이버/위키 크롤링 (DB 미스 시에만)
  let url = await fetchFromNaver(name, context);

  // 2. Fall back to Wikipedia
  if (!url) {
    url = await fetchFromWikipedia(name);
  }

  cache.set(cacheKey, { url, fetchedAt: Date.now() });
  await saveToDb(name, url);
  return url;
}

export async function getBatchPhotoUrls(names: string[]): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};
  await Promise.allSettled(
    names.map(async (name) => {
      results[name] = await getPoliticianPhotoUrl(name);
    })
  );
  return results;
}

export async function preFetchPhotos(names: string[]): Promise<void> {
  await Promise.allSettled(
    names.map((name) => getPoliticianPhotoUrl(name))
  );
}

// 사진 프록시 호스트 화이트리스트 — 외부 검색 HTML 정규식에서 추출된 URL을 그대로 fetch하지 않기 위함 (SSRF 방어)
const PHOTO_HOST_ALLOWLIST = new Set([
  "search.pstatic.net",
  "sstatic.naver.net",
  "upload.wikimedia.org",
  "open.assembly.go.kr",
]);

function isAllowedPhotoUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return false;
    if (host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
    if (host === "169.254.169.254") return false;
    return PHOTO_HOST_ALLOWLIST.has(host);
  } catch {
    return false;
  }
}

export async function proxyImage(photoUrl: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (!isAllowedPhotoUrl(photoUrl)) {
    return null;
  }
  try {
    const r = await axios.get(photoUrl, {
      responseType: "arraybuffer",
      timeout: 8000,
      maxRedirects: 2,
      maxContentLength: 5 * 1024 * 1024,
      headers: { "User-Agent": UA },
      validateStatus: (s) => s >= 200 && s < 300,
    });
    const contentType = (r.headers["content-type"] as string) || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    return { data: Buffer.from(r.data), contentType };
  } catch {
    return null;
  }
}
