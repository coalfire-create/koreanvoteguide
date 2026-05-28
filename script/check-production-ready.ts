#!/usr/bin/env tsx
/**
 * 프로덕션 배포 전 환경변수 및 설정 검증 스크립트
 * 실행: npx tsx --env-file=.env script/check-production-ready.ts
 */

import "dotenv/config";

interface CheckResult {
  name: string;
  ok: boolean;
  level: "error" | "warn" | "info";
  detail?: string;
}

const results: CheckResult[] = [];

function check(name: string, condition: boolean, level: "error" | "warn" | "info" = "error", detail?: string) {
  results.push({ name, ok: condition, level, detail });
}

// ── 필수 환경변수 ─────────────────────────────────────────────
check("DATABASE_URL 설정됨", !!process.env.DATABASE_URL, "error");
check("DATABASE_URL Supabase/Postgres 형식", 
  (process.env.DATABASE_URL || "").startsWith("postgresql://") || (process.env.DATABASE_URL || "").startsWith("postgres://"),
  "error", "postgresql:// 또는 postgres:// 로 시작해야 합니다"
);

check("SESSION_SECRET 설정됨", !!process.env.SESSION_SECRET, "error");
check("SESSION_SECRET 32자 이상", (process.env.SESSION_SECRET || "").length >= 32, "error",
  `현재 길이: ${(process.env.SESSION_SECRET || "").length}`
);

check("PHONE_PEPPER 설정됨", !!process.env.PHONE_PEPPER, "error");
check("PHONE_PEPPER 32자 이상", (process.env.PHONE_PEPPER || "").length >= 32, "error",
  `현재 길이: ${(process.env.PHONE_PEPPER || "").length}`
);

check("ALLOWED_ORIGIN 설정됨", !!process.env.ALLOWED_ORIGIN, "error");

// ── 관리자 ────────────────────────────────────────────────────
const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
check("ADMIN_USER_IDS 설정됨", adminIds.length > 0, "warn",
  "비어있으면 /api/admin/*, /api/sync/* 전부 차단됨 (fail-closed)"
);
check("ADMIN_USER_IDS UUID 형식", 
  adminIds.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)),
  "warn", `설정된 ID: ${adminIds.join(", ") || "(없음)"}`
);

// ── AI ────────────────────────────────────────────────────────
const hasAI = !!(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
check("AI API 키 최소 1개 설정됨", hasAI, "warn",
  "미설정 시 AI 분석·평가·공약 요약 기능이 503 반환됩니다"
);

// ── OAuth ─────────────────────────────────────────────────────
check("KAKAO_REST_API_KEY 설정됨", !!process.env.KAKAO_REST_API_KEY, "error",
  "카카오 로그인에 필수"
);
check("KAKAO_REDIRECT_URI 설정됨", !!process.env.KAKAO_REDIRECT_URI, "error");
check("KAKAO_REDIRECT_URI HTTPS", 
  (process.env.KAKAO_REDIRECT_URI || "").startsWith("https://"),
  "error"
);

check("GOOGLE_CLIENT_ID 설정됨", !!process.env.GOOGLE_CLIENT_ID, "error",
  "구글 로그인에 필수"
);
check("GOOGLE_CLIENT_SECRET 설정됨", !!process.env.GOOGLE_CLIENT_SECRET, "error");
check("GOOGLE_REDIRECT_URI HTTPS",
  (process.env.GOOGLE_REDIRECT_URI || "").startsWith("https://"),
  "error"
);

// ── 선거/공공데이터 ───────────────────────────────────────────
check("ELECTION_DAY 설정됨", !!process.env.ELECTION_DAY, "warn",
  "미설정 시 여론조사 블랙아웃(§108) 기능이 동작하지 않습니다"
);
check("ELECTION_DAY 날짜 형식", 
  !process.env.ELECTION_DAY || /^\d{4}-\d{2}-\d{2}$/.test(process.env.ELECTION_DAY || ""),
  "warn", "YYYY-MM-DD 형식이어야 합니다"
);

check("OPEN_ASSEMBLY_API_KEY 설정됨", !!process.env.OPEN_ASSEMBLY_API_KEY, "warn",
  "미설정 시 의안·의원 데이터 동기화 불가"
);

// ── 보안 ─────────────────────────────────────────────────────
check("ENABLE_DEV_TESTER 비활성화", 
  !process.env.ENABLE_DEV_TESTER || process.env.ENABLE_DEV_TESTER === "0",
  "error", "프로덕션에서 1이면 tester/test1234 백도어 계정이 활성화됩니다"
);

// ── Apple OAuth (선택) ────────────────────────────────────────
const appleConfigured = !!(
  process.env.APPLE_TEAM_ID &&
  process.env.APPLE_KEY_ID &&
  process.env.APPLE_SERVICE_ID &&
  process.env.APPLE_PRIVATE_KEY
);
check("Apple 로그인 환경변수 설정됨", appleConfigured, "info",
  appleConfigured
    ? "Apple 로그인 사용 가능"
    : "미설정 상태 — App Store 심사 전 Xcode Capability + Services ID 설정 후 추가"
);

// ── 결과 출력 ─────────────────────────────────────────────────
console.log("\n🔍 프로덕션 준비 상태 검증\n" + "=".repeat(50));

const errors = results.filter(r => !r.ok && r.level === "error");
const warns = results.filter(r => !r.ok && r.level === "warn");
const infos = results.filter(r => r.level === "info");
const passed = results.filter(r => r.ok);

console.log(`\n✅ 통과: ${passed.length}개`);
if (errors.length > 0) {
  console.log(`\n❌ 오류 (${errors.length}개) — 배포 전 반드시 수정:`);
  errors.forEach(r => {
    console.log(`  ❌ ${r.name}`);
    if (r.detail) console.log(`     → ${r.detail}`);
  });
}
if (warns.length > 0) {
  console.log(`\n⚠️  경고 (${warns.length}개) — 권장 수정:`);
  warns.forEach(r => {
    console.log(`  ⚠️  ${r.name}`);
    if (r.detail) console.log(`     → ${r.detail}`);
  });
}
if (infos.length > 0) {
  console.log(`\nℹ️  참고:`);
  infos.forEach(r => {
    console.log(`  ℹ️  ${r.name}: ${r.detail || ""}`);
  });
}

console.log("\n" + "=".repeat(50));
if (errors.length === 0) {
  console.log("🚀 배포 준비 완료! (경고가 있다면 확인 후 진행하세요)");
} else {
  console.log(`🚫 ${errors.length}개 오류 수정 후 재실행하세요.`);
  process.exit(1);
}
