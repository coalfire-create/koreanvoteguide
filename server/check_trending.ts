import { db } from "./db";
import { assemblyBills } from "../shared/schema";
import { sql, desc } from "drizzle-orm";

async function main() {
  const trendingScore = sql<number>`(
    COALESCE(${assemblyBills.viewCount}, 0) * 1
    + COALESCE(${assemblyBills.voteCount}, 0) * 5
    + COALESCE(${assemblyBills.mediaMentionCount}, 0) * 10
    + COALESCE(${assemblyBills.coProposerCount}, 0) * 2
    - GREATEST(
        EXTRACT(EPOCH FROM (NOW() - TO_TIMESTAMP(
          NULLIF(${assemblyBills.proposeDate}, ''), 'YYYY-MM-DD'
        ))) / 86400.0 * 0.5,
        0
      )
  )`.as("trending_score");

  const bills = await db.select({
      billId: assemblyBills.billId,
      billName: assemblyBills.billName,
      coProposerCount: assemblyBills.coProposerCount,
      mediaMentionCount: assemblyBills.mediaMentionCount,
      newsMentionCount: assemblyBills.newsMentionCount,
      viewCount: assemblyBills.viewCount,
      voteCount: assemblyBills.voteCount,
      trendingScore
  }).from(assemblyBills)
    .orderBy(desc(trendingScore))
    .limit(5);

  console.log("Hot bills:", JSON.stringify(bills, null, 2));
  process.exit(0);
}
main();
