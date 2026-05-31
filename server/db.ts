import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// Supabase(및 대부분의 매니지드 Postgres)는 TLS 연결을 요구한다.
// node-postgres는 connectionString의 sslmode를 항상 신뢰하지 않으므로 명시적으로 ssl을 켠다.
// localhost(로컬 개발) 연결만 평문 허용.
const dbUrl = process.env.DATABASE_URL;
const isLocalDb = /@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);
const useSsl =
  process.env.PGSSL === "true" ||
  (!isLocalDb && (dbUrl.includes("supabase.") || process.env.NODE_ENV === "production"));

// ⚠️ 운영 권장: 장시간 떠 있는 Node 서버 + 자체 pg.Pool 조합에서는
// Supabase의 Transaction Pooler(포트 6543) 대신 Session Pooler(포트 5432)나
// 다이렉트 연결을 사용하는 편이 안전하다(6543은 prepared statement·세션 상태 미지원).
// DATABASE_URL의 포트가 6543이면 5432로 바꾸는 것을 검토할 것.
if (dbUrl.includes(":6543/")) {
  console.warn(
    "[db] DATABASE_URL이 Transaction Pooler(6543)를 가리킵니다. " +
      "장시간 실행 서버에는 Session Pooler(5432) 사용을 권장합니다.",
  );
}

export const pool = new pg.Pool({
  connectionString: dbUrl,
  // Supabase 풀러 인증서는 자체 CA 체인이라 rejectUnauthorized=false로 둔다(전송은 TLS 암호화됨).
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  // 매니지드 풀러 환경에서 커넥션 누수/타임아웃 방지
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (err) => {
  // 유휴 클라이언트에서 발생하는 에러로 프로세스가 죽지 않도록 흡수
  console.error("[db] idle client error:", err.message);
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

// device_tokens 테이블 자동 생성 (푸시 알림)
pool.query(`
  CREATE TABLE IF NOT EXISTS device_tokens (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL,
    platform TEXT DEFAULT 'ios' NOT NULL,
    user_id VARCHAR,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    last_seen_at TIMESTAMP DEFAULT NOW() NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_token_uniq ON device_tokens (token);
`).catch((err: any) => {
  if (err.code !== 'ECONNREFUSED') {
    console.warn("[db] device_tokens 테이블 생성 경고:", err.message);
  }
});

// user_blocks 테이블 자동 생성 (사용자 차단 — UGC 모더레이션)
pool.query(`
  CREATE TABLE IF NOT EXISTS user_blocks (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id VARCHAR NOT NULL,
    blocked_id VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS user_blocks_blocker_blocked_uniq ON user_blocks (blocker_id, blocked_id);
  CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx ON user_blocks (blocker_id);
`).catch((err: any) => {
  if (err.code !== 'ECONNREFUSED') {
    console.warn("[db] user_blocks 테이블 생성 경고:", err.message);
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
