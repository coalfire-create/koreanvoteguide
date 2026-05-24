import { db } from "./db";
import { assemblyBills } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const bills = await db.select().from(assemblyBills).limit(20);
  console.log("Sample bills mediaMentionCount vs newsMentionCount:", bills.map(b => ({
    billId: b.billId,
    billName: b.billName,
    mediaMentionCount: b.mediaMentionCount,
    newsMentionCount: b.newsMentionCount
  })));
  process.exit(0);
}
main();
