import { db } from "./db";
import { assemblyBills, assemblyVotes } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

export interface PoliticianStance {
  econScore: number;
  socialScore: number;
  envScore: number;
  welfareScore: number;
  justiceScore: number;
  scoredBillCount: number;
  hasData: boolean;
}

/**
 * 의원의 찬반 투표 기록과 법안별 성향 점수를 기반으로
 * 이념 성향(경제/사회/환경/복지/정의) 점수를 계산한다.
 *
 * - 찬성한 법안: 법안의 점수를 그대로 더함
 * - 반대한 법안: 법안의 점수를 역산(부호 반전)하여 더함
 * - 기권/불출석: 제외
 * - 점수가 null인 법안: 제외
 *
 * 최종값 = 유효 법안 점수들의 평균 (범위: -10 ~ +10)
 */
export async function calculatePoliticianStance(
  legislatorId: string
): Promise<PoliticianStance> {
  const votes = await db
    .select({
      billId: assemblyVotes.billId,
      voteResult: assemblyVotes.voteResult,
    })
    .from(assemblyVotes)
    .where(eq(assemblyVotes.legislatorId, legislatorId));

  if (votes.length === 0) {
    return {
      econScore: 0,
      socialScore: 0,
      envScore: 0,
      welfareScore: 0,
      justiceScore: 0,
      scoredBillCount: 0,
      hasData: false,
    };
  }

  const billIds = votes.map((v) => v.billId);

  const bills = await db
    .select({
      billId: assemblyBills.billId,
      econScore: assemblyBills.econScore,
      socialScore: assemblyBills.socialScore,
      envScore: assemblyBills.envScore,
      welfareScore: assemblyBills.welfareScore,
      justiceScore: assemblyBills.justiceScore,
    })
    .from(assemblyBills)
    .where(inArray(assemblyBills.billId, billIds));

  const billMap = new Map(bills.map((b) => [b.billId, b]));

  let totalEcon = 0;
  let totalSocial = 0;
  let totalEnv = 0;
  let totalWelfare = 0;
  let totalJustice = 0;
  let count = 0;

  for (const vote of votes) {
    const bill = billMap.get(vote.billId);
    if (!bill) continue;

    // 최소 하나라도 점수가 있는 법안만 카운트
    if (
      bill.econScore == null &&
      bill.socialScore == null &&
      bill.envScore == null &&
      bill.welfareScore == null &&
      bill.justiceScore == null
    ) {
      continue;
    }

    let multiplier = 0;
    if (vote.voteResult === "찬성") multiplier = 1;
    else if (vote.voteResult === "반대") multiplier = -1;
    else continue;

    totalEcon += (bill.econScore ?? 0) * multiplier;
    totalSocial += (bill.socialScore ?? 0) * multiplier;
    totalEnv += (bill.envScore ?? 0) * multiplier;
    totalWelfare += (bill.welfareScore ?? 0) * multiplier;
    totalJustice += (bill.justiceScore ?? 0) * multiplier;
    count++;
  }

  if (count === 0) {
    return {
      econScore: 0,
      socialScore: 0,
      envScore: 0,
      welfareScore: 0,
      justiceScore: 0,
      scoredBillCount: 0,
      hasData: false,
    };
  }

  const clamp = (v: number) => Math.max(-10, Math.min(10, v));
  const round1 = (v: number) => Math.round(v * 10) / 10;

  return {
    econScore: round1(clamp(totalEcon / count)),
    socialScore: round1(clamp(totalSocial / count)),
    envScore: round1(clamp(totalEnv / count)),
    welfareScore: round1(clamp(totalWelfare / count)),
    justiceScore: round1(clamp(totalJustice / count)),
    scoredBillCount: count,
    hasData: true,
  };
}
