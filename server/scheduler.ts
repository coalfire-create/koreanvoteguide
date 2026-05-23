import cron from "node-cron";
import axios from "axios";
import { db } from "./db";
import { assemblyDataCache, schedulerStatus, verificationCodes, searchHistory, users, legislators, assemblyBills, assemblyVotes, aiCache } from "@shared/schema";
import { eq, lt, and, isNotNull, sql, isNull, desc } from "drizzle-orm";
import { callLLMText, callLLMJson } from "./utils/llm-wrapper";
import { getAiCache, setAiCache } from "./utils/ai-cache";
import { log } from "./index";

const API_BASE = "https://open.assembly.go.kr/portal/openapi";
const API_KEY = process.env.OPEN_ASSEMBLY_API_KEY || process.env.ASSEMBLY_API_KEY;

const API_ENDPOINTS = {
  members: "nwvrqwxyaytdsfvhu",
  votes: "nojepdqqaweusdfbi",
  bills: "nzmimeepazxkubdpn",
  attendance: "nekcaihpamofqktdn",
};

const DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchApiData(serviceId: string, params: Record<string, string> = {}): Promise<any[]> {
  const url = `${API_BASE}/${serviceId}`;
  const response = await axios.get(url, {
    params: {
      Key: API_KEY,
      Type: "json",
      pIndex: "1",
      pSize: "300",
      ...params,
    },
    timeout: 30000,
  });

  const data = response.data;
  const serviceData = data?.[serviceId];
  if (!serviceData || !Array.isArray(serviceData)) {
    const errorInfo = serviceData?.[0]?.head?.[1]?.RESULT;
    if (errorInfo?.CODE && errorInfo.CODE !== "INFO-000") {
      throw new Error(`API 오류 (${serviceId}): ${errorInfo.MESSAGE || errorInfo.CODE}`);
    }
    return [];
  }

  const head = serviceData[0]?.head;
  const result = head?.[1]?.RESULT;
  if (result?.CODE && result.CODE !== "INFO-000") {
    throw new Error(`API 오류 (${serviceId}): ${result.MESSAGE || result.CODE}`);
  }

  const rows = serviceData[1]?.row;
  return Array.isArray(rows) ? rows : [];
}

async function saveCache(key: string, data: any[]): Promise<void> {
  await db
    .insert(assemblyDataCache)
    .values({ key, data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: assemblyDataCache.key,
      set: { data, updatedAt: new Date() },
    });
}

async function updateSchedulerStatus(success: boolean, errorMessage?: string): Promise<void> {
  const now = new Date();
  const [existing] = await db.select().from(schedulerStatus).where(eq(schedulerStatus.id, "main"));

  if (existing) {
    await db.update(schedulerStatus).set({
      lastRun: now,
      success,
      errorMessage: errorMessage || null,
      consecutiveFailures: success ? 0 : existing.consecutiveFailures + 1,
      updatedAt: now,
    }).where(eq(schedulerStatus.id, "main"));
  } else {
    await db.insert(schedulerStatus).values({
      id: "main",
      lastRun: now,
      success,
      errorMessage: errorMessage || null,
      consecutiveFailures: success ? 0 : 1,
      updatedAt: now,
    });
  }

  if (!success) {
    const [status] = await db.select().from(schedulerStatus).where(eq(schedulerStatus.id, "main"));
    if (status && status.consecutiveFailures >= 3) {
      log(`⚠️ [관리자 알림] 데이터 수집 연속 ${status.consecutiveFailures}회 실패! 확인이 필요합니다.`, "scheduler");
    }
  }
}

let isSyncing = false;

export async function fetchAssemblyData(): Promise<{ success: boolean; message: string }> {
  if (isSyncing) {
    const msg = "데이터 동기화가 이미 진행 중입니다.";
    log(msg, "scheduler");
    return { success: false, message: msg };
  }
  isSyncing = true;

  try {
    if (!API_KEY) {
      const msg = "OPEN_ASSEMBLY_API_KEY 환경변수가 설정되지 않았습니다. Mock 데이터를 사용합니다.";
      log(msg, "scheduler");
      await updateSchedulerStatus(false, msg);
      return { success: false, message: msg };
    }

    log("데이터 수집 시작...", "scheduler");
    const results: string[] = [];

    const AGE = "22";

    log("국회의원 기본정보 수집 중...", "scheduler");
    const members = await fetchApiData(API_ENDPOINTS.members, { AGE });
    if (members.length > 0) {
      await saveCache("members", members);
      log(`국회의원 ${members.length}명 데이터 저장 완료`, "scheduler");
      results.push(`의원: ${members.length}명`);
    }

    await delay(DELAY_MS);

    log("본회의 표결 결과 수집 중...", "scheduler");
    const votes = await fetchApiData(API_ENDPOINTS.votes, { AGE, pSize: "100" });
    if (votes.length > 0) {
      await saveCache("votes", votes);
      log(`표결 기록 ${votes.length}건 데이터 저장 완료`, "scheduler");
      results.push(`표결: ${votes.length}건`);
    }

    await delay(DELAY_MS);

    log("법안 목록 수집 중...", "scheduler");
    const bills = await fetchApiData(API_ENDPOINTS.bills, { AGE, pSize: "100" });
    if (bills.length > 0) {
      await saveCache("bills", bills);
      log(`법안 ${bills.length}건 데이터 저장 완료`, "scheduler");
      results.push(`법안: ${bills.length}건`);
    }

    await delay(DELAY_MS);

    log("의원 출석 정보 수집 중...", "scheduler");
    const attendance = await fetchApiData(API_ENDPOINTS.attendance, { AGE });
    if (attendance.length > 0) {
      await saveCache("attendance", attendance);
      log(`출석 정보 ${attendance.length}건 데이터 저장 완료`, "scheduler");
      results.push(`출석: ${attendance.length}건`);
    }

    const summary = `데이터 수집 완료: ${results.join(", ")}`;
    log(summary, "scheduler");
    await updateSchedulerStatus(true);
    return { success: true, message: summary };
  } catch (error: any) {
    const errorMsg = error?.message || "알 수 없는 오류";
    log(`데이터 수집 실패: ${errorMsg}`, "scheduler");
    await updateSchedulerStatus(false, errorMsg);
    return { success: false, message: `데이터 수집 실패: ${errorMsg}` };
  } finally {
    isSyncing = false;
  }
}

// 만료 인증번호·오래된 검색기록·30일 지난 탈퇴 회원 행 정리.
// 개인정보 최소 보관 원칙(개인정보보호법 §21).
async function cleanupExpiredRows(): Promise<void> {
  try {
    const now = new Date();
    const deletedCodes = await db
      .delete(verificationCodes)
      .where(lt(verificationCodes.expiresAt, now));
    void deletedCodes;

    // 검색기록은 30일 retention
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    await db.delete(searchHistory).where(lt(searchHistory.createdAt, thirtyDaysAgo));

    // 탈퇴 후 30일 지난 회원 행 완전 삭제
    await db
      .delete(users)
      .where(and(isNotNull((users as any).deletedAt), lt((users as any).deletedAt, thirtyDaysAgo)));

    log("만료 인증번호/검색기록/탈퇴회원 정리 완료", "cleanup");
  } catch (err: any) {
    log(`정리 작업 오류: ${err.message}`, "cleanup");
  }
}

export function startScheduler(): void {
  log("데이터 수집 스케줄러 시작 (매 1시간마다 실행)", "scheduler");

  fetchAssemblyData().catch((err) => {
    log(`초기 데이터 수집 오류: ${err.message}`, "scheduler");
  });

  cron.schedule("0 * * * *", async () => {
    log("정기 데이터 수집 실행 중...", "scheduler");
    await fetchAssemblyData();
  });

  // 매일 03:30 KST 만료 row 정리
  cron.schedule("30 3 * * *", () => {
    cleanupExpiredRows();
  });

  // 시작 1분 뒤 1회 즉시 실행
  setTimeout(() => cleanupExpiredRows(), 60 * 1000);

  // ===== 2026 지방선거 후보자 자동 동기화 =====
  // 서버 시작 2분 뒤 1회 즉시 실행 후, 매일 06:00에 정기 갱신.
  const runElectionSync = () => {
    import("./nec-sync")
      .then((m) => m.syncElectionCandidates())
      .then((r) => log(`선거 후보자 동기화 완료: ${r.inserted}건 신규, ${r.updated}건 갱신, ${r.errors}건 오류`, "election-sync"))
      .catch((e) => log(`선거 후보자 동기화 실패: ${e.message}`, "election-sync"));
  };

  setTimeout(runElectionSync, 2 * 60 * 1000);
  cron.schedule("0 6 * * *", runElectionSync);

  // ===== 선관위 공식사진 자동 반영 =====
  // 5/21 후보자 등록 마감 이후 API에 공식사진이 확정됨.
  // 5/21 00:05 KST (= 15:05 UTC 5/20) 1회 실행 → 이후 매일 06:10에 재시도 (누락 보완).
  const NEC_PHOTO_SYNC_START = new Date("2026-05-21T00:05:00+09:00");

  const runPhotoSync = () => {
    if (new Date() < NEC_PHOTO_SYNC_START) return; // 5/21 이전이면 스킵
    import("./nec-sync")
      .then((m) => m.syncCandidatePhotos())
      .then((r) => log(`선관위 공식사진 동기화 완료: ${r.updated}건 업데이트, ${r.noPhoto}건 사진없음, ${r.errors}건 오류`, "photo-sync"))
      .catch((e) => log(`선관위 공식사진 동기화 실패: ${e.message}`, "photo-sync"));
  };

  // 5/21 00:05 KST (UTC 5/20 15:05) 1회 실행
  cron.schedule("5 15 20 5 *", runPhotoSync, { timezone: "UTC" });
  // 5/21 이후 매일 06:10 KST 재시도 (누락 후보 보완)
  cron.schedule("10 21 * * *", runPhotoSync, { timezone: "UTC" });

  // ===== AI 캐시 사전 생성 (야간 off-peak) =====
  // 02:00 KST (= 17:00 UTC): 트렌딩 상위 20명 의원 프로필 분석 사전 생성
  cron.schedule("0 17 * * *", () => preGenerateMemberProfiles(), { timezone: "UTC" });
  // 03:00 KST (= 18:00 UTC): 법안 AI 설명 누락 항목 채우기
  cron.schedule("0 18 * * *", () => preGenerateBillDescriptions(), { timezone: "UTC" });
  // 매일 04:00 KST (= 19:00 UTC): 만료된 ai_cache 행 삭제
  cron.schedule("0 19 * * *", () => cleanupAiCache(), { timezone: "UTC" });

  void sql;
}

// ===== AI 사전 생성 유틸 =====

async function preGenerateMemberProfiles(): Promise<void> {
  log("의원 프로필 AI 사전 생성 시작...", "ai-pregen");
  try {
    const topMembers = await db
      .select({
        monaCd: legislators.monaCd,
        name: legislators.name,
        party: legislators.party,
        district: legislators.district,
        followerCount: legislators.followerCount,
        profileViewCount: legislators.profileViewCount,
        recentNewsCount: legislators.recentNewsCount,
      })
      .from(legislators)
      .orderBy(
        desc(
          sql<number>`${legislators.followerCount} * 20 + ${legislators.profileViewCount} + ${legislators.recentNewsCount} * 5`,
        ),
      )
      .limit(20);

    let generated = 0;
    for (const m of topMembers) {
      const cacheKey = `analyze-profile::${m.monaCd}`;
      const existing = await getAiCache<object>(cacheKey);
      if (existing) continue; // 이미 신선한 캐시 있음

      const voteRows = await db
        .select({ billName: assemblyBills.billName, committee: assemblyBills.committee, voteResult: assemblyVotes.voteResult })
        .from(assemblyVotes)
        .leftJoin(assemblyBills, eq(assemblyVotes.billId, assemblyBills.billId))
        .where(eq(assemblyVotes.legislatorId, m.monaCd))
        .limit(40);

      if (voteRows.length < 3) continue;

      const voteSummary = voteRows
        .filter((v) => v.billName)
        .map((v) => `${v.voteResult}: ${v.billName}${v.committee ? ` (${v.committee})` : ""}`)
        .join("\n");

      const profileSchema =
        "당신은 대한민국 국회의원의 표결 기록을 분석하는 중립적인 정치 전문가입니다. " +
        "반드시 아래 JSON 스키마만 출력하세요. 다른 텍스트는 절대 포함하지 마세요.\n" +
        JSON.stringify({
          summary: "경제 분야에서 친기업·규제완화 성향이 뚜렷하며, 재정 건전성을 중시합니다. (1문장, 50자 이내)",
          orientation: { economy: 7, government: 3 },
          topInterests: [
            { field: "경제", percentage: 45 },
            { field: "복지", percentage: 30 },
            { field: "교육", percentage: 25 },
          ],
          crucialBills: [
            { billName: "중대재해처벌법 개정안", reason: "기업 규제 완화에 찬성 표결을 던짐" },
            { billName: "법안명2", reason: "이유2" },
            { billName: "법안명3", reason: "이유3" },
          ],
        }) +
        "\n\norientation.economy: 0=친노동/시장개입, 10=친기업/규제완화\n" +
        "orientation.government: 0=큰정부/복지확대, 10=작은정부/감세\n" +
        "topInterests: 관심분야 TOP3, 합계 100\n" +
        "crucialBills: 성향 파악에 결정적인 법안 3개";

      try {
        const result = await callLLMJson<object>({
          system: profileSchema,
          user: `의원: ${m.name} (${m.party} / ${m.district})\n\n최근 표결 기록 (${voteRows.length}건):\n${voteSummary}`,
          temperature: 0.2,
          maxTokens: 700,
          label: "members/analyze-profile/pregen",
          provider: "openai",
        });
        await setAiCache(cacheKey, "analyze-profile", result);
        generated++;
        await new Promise((r) => setTimeout(r, 500));
      } catch (e: any) {
        log(`의원 프로필 사전 생성 실패 (${m.name}): ${e.message}`, "ai-pregen");
      }
    }
    log(`의원 프로필 AI 사전 생성 완료: ${generated}건`, "ai-pregen");
  } catch (err: any) {
    log(`의원 프로필 사전 생성 전체 오류: ${err.message}`, "ai-pregen");
  }
}

async function preGenerateBillDescriptions(): Promise<void> {
  log("법안 AI 설명 사전 생성 시작...", "ai-pregen");
  if (!process.env.GROQ_API_KEY) {
    log("GROQ_API_KEY 미설정, 법안 설명 사전 생성 스킵", "ai-pregen");
    return;
  }
  try {
    const bills = await db
      .select({ billId: assemblyBills.billId, billName: assemblyBills.billName, committee: assemblyBills.committee, proposer: assemblyBills.proposer })
      .from(assemblyBills)
      .where(isNull(assemblyBills.aiDescription))
      .orderBy(desc(assemblyBills.proposeDate))
      .limit(50);

    let generated = 0;
    for (const bill of bills) {
      try {
        const context = [
          bill.committee ? `소관위원회: ${bill.committee}` : "",
          bill.proposer ? `발의자: ${bill.proposer}` : "",
        ].filter(Boolean).join(", ");

        const description = await callLLMText({
          system:
            "당신은 한국 국회 법안을 시민이 쉽게 이해할 수 있도록 설명하는 전문가입니다. " +
            "2~3문장(80자 이내)으로만 설명하세요. 다른 말은 하지 마세요.",
          user: `법안명: ${bill.billName}${context ? `\n추가정보: ${context}` : ""}`,
          temperature: 0.3,
          maxTokens: 200,
          label: "bills/describe/pregen",
        });

        await db
          .update(assemblyBills)
          .set({ aiDescription: description })
          .where(eq(assemblyBills.billId, bill.billId));
        generated++;
        await new Promise((r) => setTimeout(r, 300));
      } catch (e: any) {
        log(`법안 설명 생성 실패 (${bill.billName}): ${e.message}`, "ai-pregen");
      }
    }
    log(`법안 AI 설명 사전 생성 완료: ${generated}건`, "ai-pregen");
  } catch (err: any) {
    log(`법안 설명 사전 생성 전체 오류: ${err.message}`, "ai-pregen");
  }
}

async function cleanupAiCache(): Promise<void> {
  try {
    await db.delete(aiCache).where(lt(aiCache.expiresAt, new Date()));
    log("만료 ai_cache 행 정리 완료", "ai-cache-cleanup");
  } catch (err: any) {
    log(`ai_cache 정리 오류: ${err.message}`, "ai-cache-cleanup");
  }
}
