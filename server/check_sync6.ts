import { db } from "./db";
import { assemblyBills } from "../shared/schema";
import { count, eq, gt } from "drizzle-orm";

async function main() {
  const c = await db.select({ count: count() }).from(assemblyBills).where(gt(assemblyBills.newsMentionCount, 0));
  const c2 = await db.select({ count: count() }).from(assemblyBills).where(gt(assemblyBills.mediaMentionCount, 0));
  const c3 = await db.select({ count: count() }).from(assemblyBills).where(gt(assemblyBills.viewCount, 0));
  const c4 = await db.select({ count: count() }).from(assemblyBills).where(gt(assemblyBills.voteCount, 0));
  console.log("Total bills with newsMentionCount > 0:", c[0].count);
  console.log("Total bills with mediaMentionCount > 0:", c2[0].count);
  console.log("Total bills with viewCount > 0:", c3[0].count);
  console.log("Total bills with voteCount > 0:", c4[0].count);
  process.exit(0);
}
main();
