import { db } from "./db";
import { assemblyBills } from "../shared/schema";
import { desc } from "drizzle-orm";

async function main() {
  const bills = await db.select().from(assemblyBills).orderBy(desc(assemblyBills.billId)).limit(5);
  console.log(JSON.stringify(bills, null, 2));
  process.exit(0);
}
main();
