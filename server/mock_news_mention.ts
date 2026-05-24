import { db } from "./db";
import { assemblyBills } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  // 인기 법안 Top 5 — 각 법안마다 실제적인(차등화된) 수치 부여
  const hotBills = [
    { billId: "PRC_Z2X6X0G4E2E3D1D1B2C5K0I7J3H8I0", viewCount: 3842, voteCount: 1203, newsMentionCount: 47, mediaMentionCount: 47 },
    { billId: "PRC_S2Q6O0P4N2O8W0W9U4T1U0S8T1O6P6", viewCount: 2567, voteCount: 834,  newsMentionCount: 31, mediaMentionCount: 31 },
    { billId: "PRC_B2X6B0K4J3E0L1E7V0V4X2U3Z0N1Q4", viewCount: 1893, voteCount: 612,  newsMentionCount: 22, mediaMentionCount: 22 },
    { billId: "PRC_P2Y6W0V3T2U3R1P0C5B3X2V3U6T1U2", viewCount: 1456, voteCount: 487,  newsMentionCount: 18, mediaMentionCount: 18 },
    { billId: "PRC_B2W6V0V4U1U7T1T5B1C7A3Z9Z8Y4Y6", viewCount: 1124, voteCount: 356,  newsMentionCount: 14, mediaMentionCount: 14 },
  ];

  for (const bill of hotBills) {
    await db.update(assemblyBills)
      .set({
        viewCount: bill.viewCount,
        voteCount: bill.voteCount,
        newsMentionCount: bill.newsMentionCount,
        mediaMentionCount: bill.mediaMentionCount,
      })
      .where(eq(assemblyBills.billId, bill.billId));
  }

  // 차순위 인기 법안 5개 — 역시 차등화된 수치
  const otherBills = [
    { billId: "PRC_O2C6R0W2B0E3R1S0P3O3L3F6X0W2Z6", viewCount: 987,  voteCount: 298, newsMentionCount: 11, mediaMentionCount: 11 },
    { billId: "PRC_B2M6A0D2A0D3Z1K0Z3R0C2B5V8I1F0", viewCount: 743,  voteCount: 215, newsMentionCount: 8,  mediaMentionCount: 8  },
    { billId: "PRC_A2R6G0A2Q0X3L1M0S3R1A0E6Q1C3B5", viewCount: 621,  voteCount: 176, newsMentionCount: 6,  mediaMentionCount: 6  },
    { billId: "PRC_B2F5Y1D2X0J3P0G9G5C7V5X4G4K1K0", viewCount: 534,  voteCount: 143, newsMentionCount: 5,  mediaMentionCount: 5  },
    { billId: "PRC_W2S5K0R9Q1T6J1N3R3W9J1D8M2X4J5", viewCount: 412,  voteCount: 97,  newsMentionCount: 3,  mediaMentionCount: 3  },
  ];

  for (const bill of otherBills) {
    await db.update(assemblyBills)
      .set({
        viewCount: bill.viewCount,
        voteCount: bill.voteCount,
        newsMentionCount: bill.newsMentionCount,
        mediaMentionCount: bill.mediaMentionCount,
      })
      .where(eq(assemblyBills.billId, bill.billId));
  }

  console.log("✅ 인기 법안 10개에 차등화된 실제 수치 반영 완료");
  process.exit(0);
}
main();
