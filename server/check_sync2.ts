import { db } from "./db";
import { assemblyBills } from "../shared/schema";
import { sql, count, desc } from "drizzle-orm";

async function main() {
  const bills = await db.select({
      billId: assemblyBills.billId,
      billName: assemblyBills.billName,
      coProposerCount: assemblyBills.coProposerCount,
      newsMentionCount: assemblyBills.newsMentionCount,
      mediaMentionCount: assemblyBills.mediaMentionCount
  }).from(assemblyBills)
    .where(sql`${assemblyBills.coProposerCount} > 0`)
    .limit(5);

  console.log("Bills with coProposers:", bills);
  process.exit(0);
}
main();
