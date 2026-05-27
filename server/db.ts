import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

// bill_opinion_votes 테이블 자동 생성 (drizzle-kit push 없이도 동작)
pool.query(`
  CREATE TABLE IF NOT EXISTS bill_opinion_votes (
    id SERIAL PRIMARY KEY,
    bill_id TEXT NOT NULL,
    user_id TEXT,
    session_id TEXT,
    opinion TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS bill_opinion_user_uniq ON bill_opinion_votes (bill_id, user_id) WHERE user_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS bill_opinion_session_uniq ON bill_opinion_votes (bill_id, session_id) WHERE session_id IS NOT NULL;
`).catch((err: any) => {
  // DB 연결 불가 시 graceful하게 무시
  if (err.code !== 'ECONNREFUSED') {
    console.warn("[db] bill_opinion_votes 테이블 생성 경고:", err.message);
  }
});

// community_posts 테이블에 has_poll 컬럼 자동 추가
pool.query(`
  ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS has_poll BOOLEAN DEFAULT FALSE NOT NULL;
`).catch((err: any) => {
  if (err.code !== 'ECONNREFUSED') {
    console.warn("[db] community_posts has_poll 컬럼 생성 경고:", err.message);
  }
});

// users 테이블에 apple_id 컬럼 자동 추가 (Sign in with Apple 재로그인 lookup 키)
pool.query(`
  ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_id TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS users_apple_id_uniq ON users (apple_id);
`).catch((err: any) => {
  if (err.code !== 'ECONNREFUSED') {
    console.warn("[db] users apple_id 컬럼 생성 경고:", err.message);
  }
});

// daily_poll_votes: user_id FK 제거 + nullable → 비로그인 투표 허용 (anon: prefix)
pool.query(`
  ALTER TABLE daily_poll_votes DROP CONSTRAINT IF EXISTS daily_poll_votes_user_id_users_id_fk;
  ALTER TABLE daily_poll_votes ALTER COLUMN user_id DROP NOT NULL;
`).catch((err: any) => {
  if (err.code !== 'ECONNREFUSED') {
    console.warn("[db] daily_poll_votes 제약 완화 경고:", err.message);
  }
});
