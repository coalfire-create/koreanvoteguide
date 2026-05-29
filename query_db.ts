import { db } from "./server/db";
import { electionCandidates } from "@shared/schema";
import { eq, and } from "drizzle-orm";
async function run() {
  const candidates = await db.select().from(electionCandidates).where(
    and(eq(electionCandidates.sdName, '서울특별시'), eq(electionCandidates.electionType, '시도지사'))
  );
  console.log(candidates.map(c => ({ name: c.name, status: c.status, candidateStatus: c.candidateStatus })));
  process.exit(0);
}
run();
