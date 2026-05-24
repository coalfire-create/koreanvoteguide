import { db } from "./db";
import { assemblyBills } from "../shared/schema";
import { count, eq, gt } from "drizzle-orm";

async function main() {
  const c = await db.select({ count: count() }).from(assemblyBills).where(gt(assemblyBills.coProposerCount, 0));
  console.log("Total bills with coProposerCount > 0:", c[0].count);
  process.exit(0);
}
main();
