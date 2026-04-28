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
