import { db } from './server/db';
import { electionCandidates } from './shared/schema';
import { count } from 'drizzle-orm';

async function check() {
  try {
    const total = await db.select({ value: count() }).from(electionCandidates);
    console.log('Total Candidate Count:', total[0].value);

    // pledges is a jsonb column
    const candidates = await db.select({ id: electionCandidates.id, pledges: electionCandidates.pledges }).from(electionCandidates);
    let emptyCount = 0;
    let filledCount = 0;
    for (const c of candidates) {
      const p = Array.isArray(c.pledges) ? c.pledges : [];
      if (p.length > 0) {
        filledCount++;
      } else {
        emptyCount++;
      }
    }
    console.log('Candidates with filled pledges:', filledCount);
    console.log('Candidates with empty pledges:', emptyCount);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
