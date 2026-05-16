/**
 * seed-schedules.ts
 *
 * 제9회 전국동시지방선거(2026-06-03) 공식 일정을 election_schedules 테이블에 삽입.
 *
 * 동작:
 *   1) 사전 정의된 OFFICIAL_2026_LOCAL_SCHEDULE 배열을 순회
 *   2) (title, eventDate) 조합이 이미 존재하면 SKIP, 없으면 INSERT
 *   3) "전국" 일정 + 시·도별 토론회 시드 데이터를 함께 삽입
 *
 * 멱등성:
 *   - 동일 (title, eventDate) 가 이미 있으면 다시 넣지 않음 → 여러 번 실행해도 안전.
 *
 * 실행:
 *   npm run seed:schedules
 *
 * 데이터 출처:
 *   중앙선거관리위원회 공식 발표 일정 (공직선거법 제33조 §1, §155 §1)
 *   필요 시 admin POST /api/admin/schedules 로 추가/수정 가능
 */

import "dotenv/config";
import { db } from "../server/db.js";
import { electionSchedules } from "../shared/schema.js";
import { and, eq } from "drizzle-orm";

interface SeedSchedule {
  title: string;
  eventDate: Date;
  description?: string;
  region?: string;
}

// ─────────────────────────────────────────────
// 2026 제9회 전국동시지방선거 공식 일정
// ─────────────────────────────────────────────
const OFFICIAL_2026_LOCAL_SCHEDULE: SeedSchedule[] = [
  {
    title: "예비후보자 등록 시작",
    eventDate: new Date("2026-02-13T00:00:00+09:00"),
    description: "시·도지사 및 교육감 예비후보 등록 개시",
    region: "전국",
  },
  {
    title: "선거인명부 작성",
    eventDate: new Date("2026-05-13T00:00:00+09:00"),
    description: "5월 13일 ~ 5월 17일",
    region: "전국",
  },
  {
    title: "후보자 등록 마감",
    eventDate: new Date("2026-05-15T18:00:00+09:00"),
    description: "5월 14일 ~ 5월 15일 18:00 마감",
    region: "전국",
  },
  {
    title: "공식 선거운동 개시",
    eventDate: new Date("2026-05-21T00:00:00+09:00"),
    description: "선거일 13일 전부터 선거일 전일까지",
    region: "전국",
  },
  {
    title: "사전투표",
    eventDate: new Date("2026-05-29T06:00:00+09:00"),
    description: "5월 29일 ~ 5월 30일 (오전 6시 ~ 오후 6시)",
    region: "전국",
  },
  {
    title: "제9회 전국동시지방선거 본투표",
    eventDate: new Date("2026-06-03T06:00:00+09:00"),
    description: "오전 6시 ~ 오후 6시 (전국 투표소)",
    region: "전국",
  },
  // 시·도별 TV 토론회 (예시 시드 — admin API 로 정확한 일정으로 갱신)
  {
    title: "서울시장 후보 1차 TV 토론회",
    eventDate: new Date("2026-05-22T20:00:00+09:00"),
    description: "MBC 생중계, 오후 8시",
    region: "서울",
  },
  {
    title: "경기도지사 후보 1차 TV 토론회",
    eventDate: new Date("2026-05-23T20:00:00+09:00"),
    description: "KBS 생중계, 오후 8시",
    region: "경기",
  },
];

async function main() {
  console.log(`📅 election_schedules 시드 시작 — ${OFFICIAL_2026_LOCAL_SCHEDULE.length}건 처리\n`);

  let inserted = 0;
  let skipped = 0;

  for (const item of OFFICIAL_2026_LOCAL_SCHEDULE) {
    const existing = await db
      .select({ id: electionSchedules.id })
      .from(electionSchedules)
      .where(
        and(
          eq(electionSchedules.title, item.title),
          eq(electionSchedules.eventDate, item.eventDate)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ⊘ SKIP   ${item.eventDate.toISOString().slice(0, 10)}  ${item.title}`);
      skipped++;
      continue;
    }

    await db.insert(electionSchedules).values({
      title: item.title,
      eventDate: item.eventDate,
      description: item.description ?? null,
      region: item.region ?? "전국",
    });
    console.log(`  ✓ INSERT ${item.eventDate.toISOString().slice(0, 10)}  ${item.title}`);
    inserted++;
  }

  console.log(`\n✅ 완료 — INSERT ${inserted}건 / SKIP ${skipped}건\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ 시드 실패:", err);
  process.exit(1);
});
