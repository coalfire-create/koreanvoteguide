import { db } from './server/db';
import { electionCandidates } from './shared/schema';
import { count } from 'drizzle-orm';

async function check() {
  try {
    const result = await db.select({ value: count() }).from(electionCandidates);
    console.log('Candidate Count:', result[0].value);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
