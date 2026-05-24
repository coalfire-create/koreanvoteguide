import { db } from "./db";
import { assemblyBills } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const bills = await db.select().from(assemblyBills).where(eq(assemblyBills.billId, "PRC_B2X6B0K4J3E0L1E7V0V4X2U3Z0N1Q4"));
  console.log("DB check for PRC_B2X6B0K4J3E0L1E7V0V4X2U3Z0N1Q4:");
  console.log(JSON.stringify(bills[0], null, 2));
  process.exit(0);
}
main();
