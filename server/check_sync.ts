import { db } from "./db";
import { billOpinionVotes, assemblyBills } from "../shared/schema";
import { sql, count } from "drizzle-orm";

async function main() {
  const votes = await db.select({ count: count() }).from(billOpinionVotes);
  const billsStats = await db.select({
      sumViewCount: sql<number>`SUM(view_count)`,
      sumVoteCount: sql<number>`SUM(vote_count)`,
      sumNewsMentionCount: sql<number>`SUM(news_mention_count)`,
      sumCoProposerCount: sql<number>`SUM(co_proposer_count)`
  }).from(assemblyBills);
  console.log("Votes:", votes);
  console.log("Bills Stats:", billsStats);
  process.exit(0);
}
main();
