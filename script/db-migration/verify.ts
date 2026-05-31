// 이관 검증 — SOURCE/TARGET DB의 앱 테이블 행 수를 대조한다.
//   SOURCE_DATABASE_URL, TARGET_DATABASE_URL 환경변수 필요.
//   실행:  tsx script/db-migration/verify.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SOURCE = process.env.SOURCE_DATABASE_URL;
const TARGET = process.env.TARGET_DATABASE_URL;
if (!SOURCE || !TARGET) {
  console.error("SOURCE_DATABASE_URL, TARGET_DATABASE_URL 환경변수가 필요합니다.");
  process.exit(1);
}

const tables = readFileSync(join(__dirname, "app-tables.txt"), "utf8")
  .split("\n")
  .map((l) => l.replace(/#.*$/, "").trim())
  .filter(Boolean);

async function counts(url: string): Promise<Map<string, number | null>> {
  const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const out = new Map<string, number | null>();
  for (const t of tables) {
    try {
      const r = await pool.query(`SELECT count(*)::int AS c FROM public.${t}`);
      out.set(t, r.rows[0].c as number);
    } catch {
      out.set(t, null); // 테이블 없음
    }
  }
  await pool.end();
  return out;
}

(async () => {
  const [src, tgt] = await Promise.all([counts(SOURCE!), counts(TARGET!)]);
  let mismatches = 0;
  console.log("\n테이블".padEnd(30), "SOURCE".padStart(10), "TARGET".padStart(10), "  상태");
  console.log("-".repeat(62));
  for (const t of tables) {
    const s = src.get(t);
    const g = tgt.get(t);
    const ok = s === g;
    if (!ok) mismatches++;
    const status = g === null ? "❌ 없음" : ok ? "✅" : "⚠️ 불일치";
    console.log(t.padEnd(30), String(s ?? "-").padStart(10), String(g ?? "-").padStart(10), "  " + status);
  }
  console.log("-".repeat(62));
  if (mismatches === 0) {
    console.log(`✅ 전체 ${tables.length}개 테이블 행 수 일치. 이관 검증 통과.`);
  } else {
    console.log(`⚠️ ${mismatches}개 테이블 불일치 — 복원 로그를 확인하세요.`);
    process.exit(2);
  }
})();
