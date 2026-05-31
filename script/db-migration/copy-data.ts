// 데이터 복사 (pg_dump 불필요) — SOURCE DB의 앱 테이블 행을 TARGET DB로 복사한다.
//
// 전제: TARGET DB에는 이미 스키마가 생성돼 있어야 한다.
//   DATABASE_URL=<TARGET> npx drizzle-kit push   # 먼저 스키마 생성(빈 새 DB라 안전)
//
// 실행:
//   export SOURCE_DATABASE_URL='...(현재 공유 DB)'
//   export TARGET_DATABASE_URL='...(새 전용 DB)'
//   tsx script/db-migration/copy-data.ts
//
// 특징: 멱등(ON CONFLICT DO NOTHING) — 중단 후 재실행해도 중복 삽입 안 됨.
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
  .split("\n").map((l) => l.replace(/#.*$/, "").trim()).filter(Boolean);

const BATCH = 200;

async function tableExists(pool: pg.Pool, t: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, [t]);
  return r.rowCount! > 0;
}

(async () => {
  const src = new pg.Pool({ connectionString: SOURCE, ssl: { rejectUnauthorized: false } });
  const tgt = new pg.Pool({ connectionString: TARGET, ssl: { rejectUnauthorized: false } });

  // FK 순서 문제 회피 시도 — 권한 없으면 무시하고 진행(이 앱은 강한 FK가 거의 없음)
  let fkDisabled = false;
  try {
    await tgt.query("SET session_replication_role = replica");
    fkDisabled = true;
  } catch {
    console.warn("ℹ️ session_replication_role 변경 불가 — FK 위반 시 해당 테이블만 실패할 수 있습니다.");
  }

  let totalCopied = 0;
  for (const t of tables) {
    if (!(await tableExists(src, t))) { console.log(`· ${t}: SOURCE에 없음 — 건너뜀`); continue; }
    if (!(await tableExists(tgt, t))) { console.warn(`⚠️ ${t}: TARGET에 없음 — 먼저 drizzle-kit push 필요. 건너뜀`); continue; }

    const rows = (await src.query(`SELECT * FROM public.${t}`)).rows;
    if (rows.length === 0) { console.log(`· ${t}: 0행`); continue; }

    const cols = Object.keys(rows[0]);
    const colList = cols.map((c) => `"${c}"`).join(", ");
    let copied = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const params: unknown[] = [];
      const valuesSql = slice.map((row) => {
        const ph = cols.map((c) => { params.push(row[c]); return `$${params.length}`; });
        return `(${ph.join(", ")})`;
      }).join(", ");
      // node-pg가 객체/배열/날짜를 jsonb/array/timestamp로 자동 직렬화함
      await tgt.query(
        `INSERT INTO public.${t} (${colList}) VALUES ${valuesSql} ON CONFLICT DO NOTHING`,
        params,
      );
      copied += slice.length;
    }
    totalCopied += copied;
    console.log(`✔ ${t}: ${copied}행 복사`);
  }

  if (fkDisabled) { try { await tgt.query("SET session_replication_role = origin"); } catch {} }
  await src.end(); await tgt.end();
  console.log(`\n완료 — 총 ${totalCopied}행. 다음: tsx script/db-migration/verify.ts 로 대조하세요.`);
})().catch((e) => { console.error("복사 실패:", e.message); process.exit(1); });
