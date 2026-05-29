import "dotenv/config";
import { db } from "../server/db.js";
import { electionCandidates } from "../shared/schema.js";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.execute(sql`SELECT election_type, COUNT(*) as count FROM election_candidates GROUP BY election_type`);
  console.log("=== DB 후보자 현황 ===");
  console.log(result.rows);
  
  const assemblyCount = await db.execute(sql`SELECT COUNT(*) as count FROM election_candidates WHERE election_type LIKE '%국회%'`);
  console.log("=== 국회의원 후보자 수 ===");
  console.log(assemblyCount.rows);
  
  const assemblySamples = await db.execute(sql`SELECT name, election_type, region_code, district_name FROM election_candidates WHERE election_type LIKE '%국회%' LIMIT 10`);
  console.log("=== 국회의원 후보자 샘플 ===");
  console.log(assemblySamples.rows);
}

main().catch(console.error).finally(() => process.exit(0));
