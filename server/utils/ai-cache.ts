import { db } from "../db.js";
import { aiCache } from "../../shared/schema.js";
import { eq, and, gt } from "drizzle-orm";

export async function getAiCache<T>(cacheKey: string): Promise<T | null> {
  try {
    const rows = await db
      .select({ result: aiCache.result })
      .from(aiCache)
      .where(and(eq(aiCache.cacheKey, cacheKey), gt(aiCache.expiresAt, new Date())))
      .limit(1);
    if (rows.length === 0) return null;
    return rows[0].result as T;
  } catch {
    return null;
  }
}

export async function setAiCache(
  cacheKey: string,
  feature: string,
  result: unknown,
  // 기본 TTL은 환경변수 AI_CACHE_TTL_DAYS 로 조절(미설정 시 7일).
  // 더 강한 실시간성이 필요하면 AI_CACHE_TTL_DAYS=1 (=24시간)로 설정.
  // 소수 가능(예: 0.5 = 12시간). 호출부에서 ttlDays를 명시하면 그 값 우선.
  ttlDays = Number(process.env.AI_CACHE_TTL_DAYS) || 7,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  await db
    .insert(aiCache)
    .values({ cacheKey, feature, result, expiresAt })
    .onConflictDoUpdate({
      target: aiCache.cacheKey,
      set: { feature, result, expiresAt },
    });
}
