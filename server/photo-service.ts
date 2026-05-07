import axios from "axios";

const USER_AGENT = "KoreanVoteGuide/1.0 (admin@example.com)";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  url: string | null;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

async function fetchFromWikipedia(name: string): Promise<string | null> {
  try {
    const r = await axios.get(
      `https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
      { timeout: 6000, headers: { "User-Agent": USER_AGENT } }
    );
    return r.data?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

export async function getMemberOfficialPhotoUrl(monaCd: string): Promise<string> {
  // Official photo pattern for the National Assembly
  return `https://www.assembly.go.kr/static/portal/img/open_assm/${monaCd}.jpg`;
}

export async function getPoliticianPhotoUrl(name: string, monaCd?: string): Promise<string | null> {
  const cacheKey = monaCd || name;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.url;
  }

  let url: string | null = null;

  // 1. Try official assembly photo if monaCd is provided
  if (monaCd) {
    const officialUrl = await getMemberOfficialPhotoUrl(monaCd);
    try {
      const check = await axios.head(officialUrl, { timeout: 3000, headers: { "User-Agent": USER_AGENT } });
      if (check.status === 200) {
        url = officialUrl;
      }
    } catch {
      // Official photo might not exist for some
    }
  }

  // 2. Try Wikipedia if official fails or not provided
  if (!url) {
    url = await fetchFromWikipedia(name);
  }

  // 3. Fallback: Search on National Assembly portal if needed (can be added later if Wikipedia fails too much)

  cache.set(cacheKey, { url, fetchedAt: Date.now() });
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

export async function proxyImage(photoUrl: string): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    const r = await axios.get(photoUrl, {
      responseType: "arraybuffer",
      timeout: 8000,
      headers: { "User-Agent": USER_AGENT },
    });
    const contentType = (r.headers["content-type"] as string) || "image/jpeg";
    return { data: Buffer.from(r.data), contentType };
  } catch {
    return null;
  }
}
