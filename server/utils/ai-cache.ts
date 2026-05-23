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
  ttlDays = 7,
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + ttlDays);
  await db
    .insert(aiCache)
    .values({ cacheKey, feature, result, expiresAt })
    .onConflictDoUpdate({
      target: aiCache.cacheKey,
      set: { feature, result, expiresAt },
    });
}
