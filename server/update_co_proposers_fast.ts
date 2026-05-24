import { db } from "./db";
import { assemblyBills } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const bills = await db.select().from(assemblyBills);
  let updated = 0;
  let batch = [];
  
  for (const bill of bills) {
    if (bill.proposer && bill.proposer.includes("등") && bill.proposer.includes("인")) {
      const match = bill.proposer.match(/등\s*(\d+)인/);
      if (match && match[1]) {
        const count = parseInt(match[1], 10);
        batch.push(db.update(assemblyBills)
          .set({ coProposerCount: count })
          .where(eq(assemblyBills.billId, bill.billId)));
        updated++;
      }
    }
    
    if (batch.length >= 100) {
      await Promise.all(batch);
      batch = [];
      console.log(`Updated ${updated} bills...`);
    }
  }
  
  if (batch.length > 0) {
    await Promise.all(batch);
  }
  
  console.log("Updated", updated, "bills with co_proposer_count in total");
  process.exit(0);
}
main();
