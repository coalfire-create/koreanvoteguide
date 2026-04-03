import cron from "node-cron";
import axios from "axios";
import { db } from "./db";
import { assemblyDataCache, schedulerStatus } from "@shared/schema";
import { eq } from "drizzle-orm";
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

export async function fetchAssemblyData(): Promise<{ success: boolean; message: string }> {
  if (!API_KEY) {
    const msg = "OPEN_ASSEMBLY_API_KEY 환경변수가 설정되지 않았습니다. Mock 데이터를 사용합니다.";
    log(msg, "scheduler");
    await updateSchedulerStatus(false, msg);
    return { success: false, message: msg };
  }

  log("데이터 수집 시작...", "scheduler");
  const results: string[] = [];

  try {
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
}
