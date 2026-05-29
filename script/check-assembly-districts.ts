import "dotenv/config";
import { db } from "../server/db.js";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.execute(sql`
    SELECT region_code, district_name, sd_name, sgg_name, wiw_name 
    FROM election_candidates 
    WHERE election_type LIKE '%국회%' 
    GROUP BY region_code, district_name, sd_name, sgg_name, wiw_name
  `);
  console.log("=== 국회의원 선거구 현황 ===");
  for (const row of result.rows) {
    console.log(row);
  }
}

main().catch(console.error).finally(() => process.exit(0));
