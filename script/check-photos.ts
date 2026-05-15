import "dotenv/config";
import { db } from "../server/db.js";
import { legislators, electionCandidates } from "../shared/schema.js";
import { sql, like, or, isNull, eq } from "drizzle-orm";

async function main() {
  const bad = await db.select({
    monaCd: legislators.monaCd,
    name: legislators.name,
    photoUrl: legislators.photoUrl
  }).from(legislators).where(
    or(
      like(legislators.photoUrl, "%t1.daumcdn.net/news%"),
      like(legislators.photoUrl, "%daumcdn.net/shophow%"),
      like(legislators.photoUrl, "%C32x32%"),
      like(legislators.photoUrl, "%harmony_static%"),
      like(legislators.photoUrl, "%expire=1%"),
      like(legislators.photoUrl, "%kakaocdn.net/thumb%")
    )
  );
  console.log("Bad photo count:", bad.length);
  console.log("Samples:", JSON.stringify(bad.slice(0, 5), null, 2));

  const total = await db.select({ count: sql`count(*)` }).from(legislators);
  const empty = await db.select({ count: sql`count(*)` }).from(legislators).where(
    or(isNull(legislators.photoUrl), eq(legislators.photoUrl, ""))
  );
  console.log("Total legislators:", total[0].count, "Empty photo:", empty[0].count);

  // election candidates
  const candTotal = await db.select({ count: sql`count(*)` }).from(electionCandidates);
  const candPhoto = await db.select({ count: sql`count(*)` }).from(electionCandidates).where(
    sql`photo IS NOT NULL AND photo != ''`
  );
  console.log("Candidates total:", candTotal[0].count, "with photo:", candPhoto[0].count);

  // sample election candidates without photo
  const noPhoto = await db
    .select({ id: electionCandidates.id, name: electionCandidates.name, districtName: electionCandidates.districtName, regionCode: electionCandidates.regionCode })
    .from(electionCandidates)
    .where(sql`photo IS NULL OR photo = ''`)
    .limit(10);
  console.log("Candidates without photo (sample):", JSON.stringify(noPhoto, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
