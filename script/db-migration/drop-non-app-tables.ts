// DATABASE_URL DB에서 "이유 앱(app-tables.txt)에 없는" public 테이블을 DROP한다.
// 안전: 기본은 dry-run(계획만 출력). 실제 삭제는 CONFIRM_DROP=yes 일 때만.
// 사전에 backup-db.ts로 전체 백업을 떠둘 것.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const URL = process.env.DATABASE_URL;
if (!URL) { console.error("DATABASE_URL 필요"); process.exit(1); }

const keep = new Set(
  readFileSync(join(__dirname, "app-tables.txt"), "utf8")
    .split("\n").map((l) => l.replace(/#.*$/, "").trim()).filter(Boolean),
);

const pool = new pg.Pool({ connectionString: URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const all: string[] = (await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`)).rows.map((r) => r.table_name);

  const drop = all.filter((t) => !keep.has(t));
  const kept = all.filter((t) => keep.has(t));

  console.log(`전체 ${all.length}개 | 유지(이유앱) ${kept.length}개 | 삭제 ${drop.length}개\n`);
  console.log("🗑  삭제 대상:"); drop.forEach((t) => console.log("   -", t));
  console.log("\n✅ 유지:"); kept.forEach((t) => console.log("   -", t));

  if (process.env.CONFIRM_DROP !== "yes") {
    console.log("\n(dry-run) 실제 삭제하려면 CONFIRM_DROP=yes 로 실행하세요.");
    await pool.end();
    return;
  }

  console.log("\n▶ 삭제 실행...");
  for (const t of drop) {
    await pool.query(`DROP TABLE IF EXISTS "${t}" CASCADE`);
    console.log("   ✔ dropped", t);
  }
  const after = (await pool.query(
    `SELECT count(*)::int AS c FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE'`)).rows[0].c;
  await pool.end();
  console.log(`\n✅ 완료 — 삭제 ${drop.length}개. 남은 테이블 ${after}개.`);
})().catch((e) => { console.error("삭제 실패:", e.message); process.exit(1); });
