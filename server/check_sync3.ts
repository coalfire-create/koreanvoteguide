import { db } from "./db";
import { assemblyBills } from "../shared/schema";
import { count } from "drizzle-orm";

async function main() {
  const c = await db.select({ count: count() }).from(assemblyBills);
  console.log("Total bills:", c[0].count);
  process.exit(0);
}
main();
