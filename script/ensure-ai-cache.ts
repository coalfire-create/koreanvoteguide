/**
 * ensure-ai-cache.ts — ai_cache 테이블을 멱등(idempotent)하게 생성한다.
 *
 * db:push 는 대화형이고 election_candidates 등에서 truncate 프롬프트를 띄울 수 있어
 * 운영 DB에는 위험하다. 이 스크립트는 ai_cache 테이블/인덱스만 IF NOT EXISTS 로
 * 생성하므로 기존 데이터에 영향이 없고, 여러 번 실행해도 안전하다.
 *
 * 로컬:  npx tsx --env-file=.env script/ensure-ai-cache.ts
 * 운영:  DATABASE_URL 환경변수가 주입된 상태에서 `npm run ensure:ai-cache`
 */
import { db } from "../server/db.js";
import { sql } from "drizzle-orm";

async function main(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_cache (
      id SERIAL PRIMARY KEY,
      cache_key TEXT NOT NULL,
      feature TEXT NOT NULL,
      result JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      expires_at TIMESTAMP NOT NULL
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS ai_cache_key_uniq ON ai_cache (cache_key)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ai_cache_expires_idx ON ai_cache (expires_at)`);
  console.log("✅ ai_cache 테이블 준비 완료");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ ai_cache 생성 실패:", e);
  process.exit(1);
});
