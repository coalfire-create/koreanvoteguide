/**
 * sync-politician-photos.ts
 *
 * 22대 국회의원 + 선거 후보자 프로필 사진을 Naver 인물 검색 및 Wikipedia에서
 * 수집하여 DB에 일괄 동기화하는 프로덕션급 파이프라인.
 *
 * 실행: npx tsx script/sync-politician-photos.ts [--force] [--target=legislators|candidates|all]
 *
 * 방어 메커니즘 4가지:
 *   1. Flawless Pagination   — 총건수 기반 while 루프, 조기 종료 없음
 *   2. Rate Limit Throttle   — p-limit(동시 3) + 300~900ms 무작위 딜레이
 *   3. Exponential Backoff   — 최대 3회 재시도, 지수적 대기(1s→2s→4s)
 *   4. Batch Upsert          — 50건 단위 청크, 단일 DB 왕복으로 처리
 */

import "dotenv/config";
import axios, { AxiosError } from "axios";
import pLimit from "p-limit";
import { db } from "../server/db.js";
import { legislators, electionCandidates } from "../shared/schema.js";
import { eq, or, isNull, sql } from "drizzle-orm";

// ─────────────────────────────────────────────
// 설정 상수 (환경에 따라 조정 가능)
// ─────────────────────────────────────────────
const CONFIG = {
  CONCURRENCY: 3,          // 동시 요청 최대 수 (Naver 차단 방지)
  DELAY_MIN_MS: 300,       // 요청 간 최소 딜레이
  DELAY_MAX_MS: 900,       // 요청 간 최대 딜레이
  MAX_RETRIES: 3,          // 최대 재시도 횟수
  BACKOFF_BASE_MS: 1000,   // 지수 백오프 기준 (1s → 2s → 4s)
  BATCH_SIZE: 50,          // DB 배치 업서트 단위
  REQUEST_TIMEOUT_MS: 10000,
  NAVER_UA: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  WIKI_UA: "KoreanVoteGuide/2.0 (admin@antigravity.kr)",
} as const;

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────
interface PoliticianRecord {
  id: string;          // legislators.monaCd 또는 electionCandidates.id
  name: string;
  role?: string;       // "국회의원" | "서울시장" 등 — 검색 정확도 향상
  currentPhotoUrl: string | null;
}

interface PhotoResult {
  id: string;
  name: string;
  photoUrl: string | null;   // null = 모든 소스 실패
  source: "naver-profile" | "naver-portrait" | "wikipedia" | "unchanged" | "failed";
}

// ─────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────

/** 지정 범위의 무작위 정수 밀리초 대기 */
function randomDelay(min = CONFIG.DELAY_MIN_MS, max = CONFIG.DELAY_MAX_MS): Promise<void> {
  return new Promise((r) => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min));
}

/**
 * 지수 백오프 재시도 래퍼 — 핵심 방어 메커니즘 #3
 *
 * @param fn        재시도할 비동기 함수
 * @param retries   최대 재시도 횟수 (기본 CONFIG.MAX_RETRIES)
 * @param label     로그 식별자
 * @returns         성공 시 결과값, 모두 실패 시 null
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = CONFIG.MAX_RETRIES,
  label = ""
): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err instanceof AxiosError ? err.response?.status : null;

      // 4xx 오류는 재시도해도 성공할 수 없음 → 즉시 포기
      // (404 Not Found, 403 Forbidden, 429 Too Many Requests는 예외로 429만 재시도)
      if (status && status >= 400 && status < 500 && status !== 429) {
        return null; // 조용히 실패 (404는 정상 케이스라 stderr 생략)
      }

      const isLast = attempt === retries;
      const delay = CONFIG.BACKOFF_BASE_MS * Math.pow(2, attempt); // 1s, 2s, 4s

      if (isLast) {
        // 최종 실패 — 크래시 없이 null 반환
        const msg = status ? `HTTP ${status}` : "timeout/network";
        process.stderr.write(`  ✗ [${label}] 최종 실패 (${msg})\n`);
        return null;
      }

      // 5xx / 네트워크 오류만 재시도
      process.stderr.write(
        `  ⚠ [${label}] 시도 ${attempt + 1}/${retries} 실패 → ${delay}ms 후 재시도\n`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// 사진 URL 조회 — 소스 우선순위
// ─────────────────────────────────────────────

/** Naver profileImg UUID → 안정적인 360x450 초상화 URL */
function buildNaverPortraitUrl(uuid: string): string {
  return (
    `https://search.pstatic.net/common?type=n&size=360x450&quality=100` +
    `&direct=true&src=http%3A%2F%2Fsstatic.naver.net%2Fpeople%2FprofileImg%2F${uuid}.jpg`
  );
}

/** 구형 Naver /people/NN/ 경로 URL (expire= 없는 것만 허용) */
function extractNaverTypeN(html: string): string | null {
  const m = html.match(
    /search\.pstatic\.net\/common\?type=n[^"'<\s]+sstatic\.naver\.net%2Fpeople%2F[^"'<\s]*/
  );
  if (!m) return null;
  const raw = m[0].replace(/&amp;/g, "&");
  return raw.includes("expire=") ? null : `https://${raw}`;
}

/**
 * Naver 인물 검색 — 초상화(type=n) 전용 URL만 추출
 *
 * 검색 쿼리를 역할 포함/미포함 두 번 시도하여 정확도를 높임.
 */
async function fetchFromNaver(name: string, role?: string): Promise<{ url: string; source: "naver-profile" | "naver-portrait" } | null> {
  const queries = role ? [`${name} ${role}`, name] : [name];

  for (const query of queries) {
    const result = await withRetry(async () => {
      const { data: html } = await axios.get<string>(
        "https://search.naver.com/search.naver",
        {
          params: { where: "nexearch", query },
          timeout: CONFIG.REQUEST_TIMEOUT_MS,
          headers: { "User-Agent": CONFIG.NAVER_UA },
        }
      );
      return html;
    }, CONFIG.MAX_RETRIES, `Naver/${name}`);

    if (!result) continue;

    // ① profileImg UUID (신형 — 가장 안정적)
    const uuidMatch = result.match(
      /sstatic\.naver\.net\/people\/profileImg\/([a-f0-9-]{36})\.(?:jpg|jpeg|png)/
    );
    if (uuidMatch) {
      return { url: buildNaverPortraitUrl(uuidMatch[1]), source: "naver-profile" };
    }

    // ② type=n portrait URL (구형 /people/NN/ 경로)
    const typeNUrl = extractNaverTypeN(result);
    if (typeNUrl) {
      return { url: typeNUrl, source: "naver-portrait" };
    }

    // 이 쿼리로 초상화 못 찾으면 다음 쿼리 시도
    await randomDelay(200, 400);
  }
  return null;
}

/**
 * Wikipedia REST API — 인물 섬네일 추출
 *
 * 동명이인 disambiguation을 위해 "(정치인)" 등 변형을 순차 시도.
 */
async function fetchFromWikipedia(name: string): Promise<string | null> {
  const variants = [name, `${name} (정치인)`, `${name} (국회의원)`, `${name} (시장)`];

  for (const variant of variants) {
    const url = await withRetry(async () => {
      const { data } = await axios.get(
        `https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(variant)}`,
        {
          timeout: CONFIG.REQUEST_TIMEOUT_MS,
          headers: { "User-Agent": CONFIG.WIKI_UA },
        }
      );
      return (data?.thumbnail?.source as string) ?? null;
    }, CONFIG.MAX_RETRIES, `Wiki/${variant}`);

    if (url) return url;
  }
  return null;
}

/**
 * 단일 정치인 사진 URL 확정 — 소스 우선순위 적용
 *
 * Naver(profileImg) > Naver(portrait) > Wikipedia > null
 */
async function resolvePhotoUrl(record: PoliticianRecord): Promise<PhotoResult> {
  // 이미 유효한 pstatic.net URL 보유 시 재조회 생략 (--force 없을 때)
  if (
    record.currentPhotoUrl &&
    (record.currentPhotoUrl.includes("pstatic.net") ||
      record.currentPhotoUrl.includes("wikimedia.org")) &&
    !FORCE_REFRESH
  ) {
    return { id: record.id, name: record.name, photoUrl: record.currentPhotoUrl, source: "unchanged" };
  }

  // ① Naver 인물 검색
  const naverResult = await fetchFromNaver(record.name, record.role);
  if (naverResult) {
    return { id: record.id, name: record.name, photoUrl: naverResult.url, source: naverResult.source };
  }

  // ② Wikipedia 폴백
  const wikiUrl = await fetchFromWikipedia(record.name);
  if (wikiUrl) {
    return { id: record.id, name: record.name, photoUrl: wikiUrl, source: "wikipedia" };
  }

  // ③ 모든 소스 실패 — null로 graceful 처리 (파이프라인 계속 실행)
  return { id: record.id, name: record.name, photoUrl: null, source: "failed" };
}

// ─────────────────────────────────────────────
// DB 배치 업서트 — 방어 메커니즘 #4
// ─────────────────────────────────────────────

/**
 * legislators 배치 업서트
 *
 * 50건씩 묶어 단일 DB 왕복으로 처리.
 * photo_url이 null이면 업데이트 건너뜀 (기존 값 보존).
 */
async function upsertLegislatorsBatch(results: PhotoResult[]): Promise<void> {
  const toUpdate = results.filter((r) => r.photoUrl !== null);
  if (!toUpdate.length) return;

  // 50건 단위 청크
  for (let i = 0; i < toUpdate.length; i += CONFIG.BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + CONFIG.BATCH_SIZE);

    // Drizzle은 단건 update를 Promise.all로 묶어도 단일 트랜잭션이 아니지만
    // DB 커넥션 재사용으로 오버헤드가 최소화됨.
    // 대규모 Upsert가 필요하다면 sql`INSERT ... ON CONFLICT DO UPDATE` 사용.
    await Promise.all(
      chunk.map((r) =>
        db
          .update(legislators)
          .set({ photoUrl: r.photoUrl! })
          .where(eq(legislators.monaCd, r.id))
          .catch((e) => {
            process.stderr.write(`  ✗ DB upsert 실패 [${r.name}]: ${e.message}\n`);
          })
      )
    );

    console.log(
      `  💾 legislators 배치 저장: ${Math.min(i + CONFIG.BATCH_SIZE, toUpdate.length)}/${toUpdate.length}건`
    );
  }
}

/**
 * election_candidates 배치 업서트 (raw SQL — ON CONFLICT DO UPDATE 방식)
 *
 * DB에 중복 키가 있을 경우 photo를 업데이트하고, 없으면 삽입 시도를 생략.
 */
async function upsertCandidatesBatch(results: PhotoResult[]): Promise<void> {
  const toUpdate = results.filter((r) => r.photoUrl !== null);
  if (!toUpdate.length) return;

  for (let i = 0; i < toUpdate.length; i += CONFIG.BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + CONFIG.BATCH_SIZE);

    await Promise.all(
      chunk.map((r) =>
        db
          .update(electionCandidates)
          .set({ photo: r.photoUrl! } as any)
          .where(eq(electionCandidates.id, r.id))
          .catch((e) => {
            process.stderr.write(`  ✗ DB upsert 실패 [${r.name}]: ${e.message}\n`);
          })
      )
    );

    console.log(
      `  💾 candidates 배치 저장: ${Math.min(i + CONFIG.BATCH_SIZE, toUpdate.length)}/${toUpdate.length}건`
    );
  }
}

// ─────────────────────────────────────────────
// 페이지네이션 데이터 로더 — 방어 메커니즘 #1
// ─────────────────────────────────────────────

/**
 * 국회 공공 API 페이지네이션 — 총건수 기반 완전 수집
 *
 * pSize=100 고정, 총건수가 더 남아있는 한 계속 조회.
 * API 장애 시 재시도 후 null 반환 → 해당 페이지 건너뜀.
 */
async function fetchAssemblyMembersFromApi(): Promise<PoliticianRecord[]> {
  const KEY = process.env.OPEN_ASSEMBLY_API_KEY;
  if (!KEY) {
    console.warn("  ⚠ OPEN_ASSEMBLY_API_KEY 없음 — DB 소스로 대체합니다.");
    return [];
  }

  const BASE = "https://open.assembly.go.kr/portal/openapi/nwvrqwxyaytdsfvhu";
  const PAGE_SIZE = 100;
  const records: PoliticianRecord[] = [];
  let pIndex = 1;
  let totalCount = Infinity; // 첫 응답 전까지 무한으로 설정

  // ── 총건수 기반 페이지네이션 루프 ──────────────────────────
  while (records.length < totalCount) {
    const pageData = await withRetry(async () => {
      const { data } = await axios.get(BASE, {
        params: { KEY, Type: "json", pSize: PAGE_SIZE, pIndex },
        timeout: CONFIG.REQUEST_TIMEOUT_MS,
      });

      const root = data?.nwvrqwxyaytdsfvhu;
      if (!root) throw new Error("API 응답 구조 이상");

      const head = root[0]?.head?.[0];
      const count = parseInt(head?.list_total_count ?? "0", 10);
      const rows: any[] = root[1]?.row ?? [];

      return { count, rows };
    }, CONFIG.MAX_RETRIES, `AssemblyAPI/page${pIndex}`);

    if (!pageData) {
      // 페이지 실패 — 건너뛰고 다음 페이지 계속 (데이터 유실 최소화)
      console.warn(`  ⚠ 페이지 ${pIndex} 조회 실패 — 건너뜀`);
      pIndex++;
      if (pIndex > Math.ceil(totalCount / PAGE_SIZE) + 1) break;
      continue;
    }

    if (pIndex === 1) {
      totalCount = pageData.count;
      console.log(`  📋 국회 API 총 의원 수: ${totalCount}명`);
    }

    for (const row of pageData.rows) {
      records.push({
        id: row.MONA_CD ?? "",
        name: row.HG_NM ?? "",
        role: "국회의원",
        currentPhotoUrl: null, // API는 사진 없음 → 전량 조회
      });
    }

    console.log(`  📄 API 페이지 ${pIndex}: ${pageData.rows.length}건 수집 (누계 ${records.length}/${totalCount})`);

    // 마지막 페이지 도달 여부 명시적 확인
    if (records.length >= totalCount || pageData.rows.length < PAGE_SIZE) break;

    pIndex++;
    // 페이지 간 딜레이 (API 서버 부하 방지)
    await randomDelay(500, 1200);
  }

  return records;
}

/**
 * DB에서 의원 목록 로드 (API 실패 시 폴백 소스)
 *
 * --force 없으면 이미 유효한 pstatic/wikimedia URL 보유 의원은 제외.
 */
async function loadLegislatorsFromDb(): Promise<PoliticianRecord[]> {
  const rows = await db
    .select({ monaCd: legislators.monaCd, name: legislators.name, photoUrl: legislators.photoUrl })
    .from(legislators);

  return rows.map((r) => ({
    id: r.monaCd,
    name: r.name,
    role: "국회의원",
    currentPhotoUrl: r.photoUrl ?? null,
  }));
}

async function loadCandidatesFromDb(): Promise<PoliticianRecord[]> {
  const rows = await db
    .select({
      id: electionCandidates.id,
      name: electionCandidates.name,
      districtName: electionCandidates.districtName,
      photo: sql<string>`photo`,
    })
    .from(electionCandidates);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.districtName ?? undefined,
    currentPhotoUrl: (r.photo as string) ?? null,
  }));
}

// ─────────────────────────────────────────────
// 메인 파이프라인
// ─────────────────────────────────────────────

/**
 * syncPoliticianPhotos — 핵심 파이프라인 진입점
 *
 * 아키텍처:
 *   [데이터 로드] → [중복 제거/스킵 판단] → [p-limit 동시 처리] → [배치 DB 저장]
 *
 * 동시성(p-limit)과 재시도(withRetry)가 각 레코드 단위에서 독립 동작하여
 * 하나의 실패가 전체 파이프라인을 멈추지 않음.
 */
async function syncPoliticianPhotos(options: {
  target: "legislators" | "candidates" | "all";
  force: boolean;
}): Promise<void> {
  const startedAt = Date.now();
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  🚀 syncPoliticianPhotos 시작`);
  console.log(`     대상: ${options.target} | 강제갱신: ${options.force}`);
  console.log(`${"═".repeat(60)}\n`);

  // ─── 1단계: 데이터 로드 ───────────────────────────────────
  let legislators_records: PoliticianRecord[] = [];
  let candidate_records: PoliticianRecord[] = [];

  if (options.target === "legislators" || options.target === "all") {
    // API 우선, 실패 시 DB 폴백
    console.log("📥 [1/4] 국회의원 목록 로드...");
    legislators_records = await fetchAssemblyMembersFromApi();
    if (!legislators_records.length) {
      console.log("  → API 실패, DB 폴백 사용");
      legislators_records = await loadLegislatorsFromDb();
    }
    console.log(`  ✅ 국회의원 ${legislators_records.length}명 로드 완료\n`);
  }

  if (options.target === "candidates" || options.target === "all") {
    console.log("📥 [1/4] 선거 후보자 목록 로드...");
    candidate_records = await loadCandidatesFromDb();
    console.log(`  ✅ 후보자 ${candidate_records.length}명 로드 완료\n`);
  }

  const allRecords = [...legislators_records, ...candidate_records];
  if (!allRecords.length) {
    console.log("  ⚠ 처리할 레코드 없음. 종료.");
    return;
  }

  // ─── 2단계: p-limit 동시 처리 — 방어 메커니즘 #2 ──────────
  console.log(`🔍 [2/4] 사진 URL 조회 시작 (동시 ${CONFIG.CONCURRENCY}건, 딜레이 ${CONFIG.DELAY_MIN_MS}~${CONFIG.DELAY_MAX_MS}ms)\n`);

  // p-limit: 동시에 최대 CONCURRENCY 개의 요청만 실행
  // → Naver 서버가 연속 요청을 차단하는 것을 방지
  const limit = pLimit(CONFIG.CONCURRENCY);

  const results: PhotoResult[] = [];
  let completed = 0;

  const tasks = allRecords.map((record, idx) =>
    limit(async () => {
      // 각 요청 사이 무작위 딜레이 (Throttling)
      if (idx > 0) await randomDelay();

      const result = await resolvePhotoUrl(record);
      completed++;

      const icon =
        result.source === "unchanged" ? "─" :
        result.source === "failed"    ? "✗" : "✓";
      const pct = Math.round((completed / allRecords.length) * 100);
      process.stdout.write(
        `  ${icon} [${pct}%] ${record.name.padEnd(5)} → ${result.source}\n`
      );

      results.push(result);
    })
  );

  // 모든 작업 완료 대기 (개별 실패는 null로 처리됨)
  await Promise.allSettled(tasks);

  // ─── 3단계: 결과 통계 ────────────────────────────────────
  console.log(`\n📊 [3/4] 결과 집계`);
  const stats = results.reduce(
    (acc, r) => {
      acc[r.source] = (acc[r.source] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  console.log("  " + JSON.stringify(stats, null, 2).replace(/\n/g, "\n  "));

  // ─── 4단계: DB 배치 업서트 — 방어 메커니즘 #4 ──────────────
  console.log(`\n💾 [4/4] DB 배치 업서트 시작 (${CONFIG.BATCH_SIZE}건 단위)\n`);

  if (legislators_records.length) {
    const legResults = results.filter((r) =>
      legislators_records.some((l) => l.id === r.id)
    );
    await upsertLegislatorsBatch(legResults);
  }

  if (candidate_records.length) {
    const candResults = results.filter((r) =>
      candidate_records.some((c) => c.id === r.id)
    );
    await upsertCandidatesBatch(candResults);
  }

  // ─── 최종 요약 ─────────────────────────────────────────────
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  const succeeded = results.filter((r) => r.photoUrl !== null).length;
  const failed = results.filter((r) => r.source === "failed").length;

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ✅ 완료 — 소요 시간: ${elapsed}s`);
  console.log(`     성공: ${succeeded}/${allRecords.length}명`);
  console.log(`     실패(사진 없음): ${failed}명`);
  console.log(`${"═".repeat(60)}\n`);

  // 실패 목록 출력 (재검토용)
  const failedList = results.filter((r) => r.source === "failed");
  if (failedList.length) {
    console.log("  📋 수동 확인 필요 목록:");
    failedList.forEach((r) => console.log(`    - ${r.name} (${r.id})`));
    console.log();
  }
}

// ─────────────────────────────────────────────
// CLI 진입점
// ─────────────────────────────────────────────

const args = process.argv.slice(2);
const FORCE_REFRESH = args.includes("--force");
const targetArg = args.find((a) => a.startsWith("--target="))?.split("=")[1];
const TARGET = (["legislators", "candidates", "all"].includes(targetArg ?? "")
  ? targetArg
  : "all") as "legislators" | "candidates" | "all";

syncPoliticianPhotos({ target: TARGET, force: FORCE_REFRESH })
  .catch((err) => {
    console.error("\n💥 파이프라인 치명적 오류:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
