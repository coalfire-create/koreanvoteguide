/**
 * context(::) 없이 이름만으로 캐시된 사진 URL을 삭제한다.
 * 동명이인 구분 없이 잡힌 잘못된 사진을 비우고, 다음 조회 시
 * 정당 context 포함 쿼리로 재크롤되게 한다.
 * 실행: tsx --env-file=.env script/invalidate-photo-cache.ts
 */
import { db } from "../server/db.js";
import { politicianPhotoCache } from "../shared/schema.js";
import { notLike } from "drizzle-orm";

async function main() {
  const before = await db.select().from(politicianPhotoCache);
  const ctxless = before.filter((r) => !r.name.includes("::"));
  console.log(`전체 캐시 ${before.length}건, context 없는 키 ${ctxless.length}건 삭제 예정`);

  const deleted = await db
    .delete(politicianPhotoCache)
    .where(notLike(politicianPhotoCache.name, "%::%"))
    .returning({ name: politicianPhotoCache.name });

  console.log(`삭제 완료: ${deleted.length}건 → 다음 조회 시 정당 context 포함 재크롤`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
