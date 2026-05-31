// 전체 DB 백업 (pg_dump 불필요) — DATABASE_URL이 가리키는 DB의 public 스키마 전체를
// schema.sql(DDL) + data/<table>.ndjson(데이터)로 받아낸다. 삭제 전 안전망.
//
// 실행:  tsx --env-file=.env script/db-migration/backup-db.ts
// 출력:  backups/<timestamp>/  (gitignore됨 — PII 포함, 절대 커밋 금지)
import { mkdirSync, writeFileSync, createWriteStream } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const URL = process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL;
if (!URL) { console.error("DATABASE_URL(또는 BACKUP_DATABASE_URL) 필요"); process.exit(1); }

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = join(process.cwd(), "backups", ts);
const dataDir = join(outDir, "data");
mkdirSync(dataDir, { recursive: true });

const pool = new pg.Pool({ connectionString: URL, ssl: { rejectUnauthorized: false }, max: 4 });

(async () => {
  const tablesRes = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
  const tables: string[] = tablesRes.rows.map((r) => r.table_name);
  console.log(`▶ ${tables.length}개 테이블 백업 → backups/${ts}/`);

  let schemaSql = `-- 백업 ${ts} — public 스키마 전체 (${tables.length} tables)\nSET client_min_messages = warning;\n\n`;
  const manifest: Record<string, number> = {};

  for (const t of tables) {
    // --- 스키마(DDL) ---
    const cols = (await pool.query(
      `SELECT a.attname AS name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
              a.attnotnull AS notnull, pg_get_expr(d.adbin, d.adrelid) AS dflt
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
       WHERE a.attrelid = ('public.'||$1)::regclass AND a.attnum>0 AND NOT a.attisdropped
       ORDER BY a.attnum`, [t])).rows;
    const colLines = cols.map((c) => {
      let line = `  "${c.name}" ${c.type}`;
      if (c.dflt) line += ` DEFAULT ${c.dflt}`;
      if (c.notnull) line += " NOT NULL";
      return line;
    });
    schemaSql += `CREATE TABLE IF NOT EXISTS "${t}" (\n${colLines.join(",\n")}\n);\n`;

    const cons = (await pool.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint WHERE conrelid=('public.'||$1)::regclass ORDER BY contype`, [t])).rows;
    const consNames = new Set(cons.map((c) => c.conname));
    for (const c of cons) {
      schemaSql += `ALTER TABLE "${t}" ADD CONSTRAINT "${c.conname}" ${c.def};\n`;
    }
    // 제약이 만든 인덱스는 제외하고 나머지 인덱스만
    const idx = (await pool.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=$1`, [t])).rows;
    for (const i of idx) {
      if (!consNames.has(i.indexname)) schemaSql += `${i.indexdef};\n`;
    }
    schemaSql += "\n";

    // --- 데이터(NDJSON) ---
    const rows = (await pool.query(`SELECT * FROM "${t}"`)).rows;
    const stream = createWriteStream(join(dataDir, `${t}.ndjson`));
    for (const row of rows) stream.write(JSON.stringify(row) + "\n");
    await new Promise<void>((res) => stream.end(res));
    manifest[t] = rows.length;
    console.log(`  ✔ ${t}: ${rows.length}행`);
  }

  writeFileSync(join(outDir, "schema.sql"), schemaSql);
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify({ ts, source: URL.replace(/:[^:@/]+@/, ":***@"), tables: manifest }, null, 2));
  await pool.end();
  const total = Object.values(manifest).reduce((a, b) => a + b, 0);
  console.log(`\n✅ 백업 완료 — ${tables.length}개 테이블, 총 ${total}행`);
  console.log(`   위치: backups/${ts}/  (schema.sql + data/*.ndjson + manifest.json)`);
})().catch((e) => { console.error("백업 실패:", e.message); process.exit(1); });
