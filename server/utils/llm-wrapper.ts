/**
 * llm-wrapper.ts — 중앙 집중식 LLM 호출 유틸리티
 *
 * 모든 AI/LLM 호출은 이 파일을 경유한다. 직접 OpenAI SDK를 import 하지 말 것.
 *
 * 보장 사항:
 *   1. Strict JSON Mode    — `response_format: { type: "json_object" }` 자동 주입
 *   2. Markdown Stripping  — ```json … ``` 펜스 제거 후 안전 파싱
 *   3. Exponential Backoff — 5xx / 429 / 네트워크 오류만 재시도 (1s → 2s → 4s)
 *   4. Deep Error Logging  — 상태코드, 에러 본문, 파싱 실패 원본 문자열까지 stderr에 기록
 *   5. Generic Typing      — `callLLMJson<T>` 로 응답 타입 컴파일 타임 보장
 */

import OpenAI from "openai";

// ─────────────────────────────────────────────
// 환경 / 상수
// ─────────────────────────────────────────────
// llama3-70b-8192는 Groq에서 decommissioned됨 (2025). 후속 모델로 대체.
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const MAX_RETRIES = 3;            // 1차 + 재시도 3 = 총 4회
const BACKOFF_BASE_MS = 1000;     // 1s → 2s → 4s

// 4xx 가운데 재시도 가치가 있는 상태코드 (rate limit)
const TRANSIENT_4XX = new Set<number>([408, 425, 429]);

// ─────────────────────────────────────────────
// 클라이언트 캐싱 — 매 호출마다 new OpenAI() 하지 않도록
// ─────────────────────────────────────────────
let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new LLMConfigError("GROQ_API_KEY 환경변수가 설정되지 않았습니다.");
  }
  cachedClient = new OpenAI({ apiKey, baseURL: DEFAULT_BASE_URL });
  return cachedClient;
}

/** GROQ_API_KEY 미설정 등 호출 자체가 불가능한 경우 */
export class LLMConfigError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "LLMConfigError";
  }
}

/** rate limit / 5xx / 네트워크 오류로 모든 재시도가 실패한 경우 */
export class LLMTransientError extends Error {
  constructor(msg: string, readonly status?: number) {
    super(msg);
    this.name = "LLMTransientError";
  }
}

/** JSON 파싱 실패 — 원본 문자열을 보존하여 상위에서 폴백 가능 */
export class LLMParseError extends Error {
  constructor(msg: string, readonly raw: string) {
    super(msg);
    this.name = "LLMParseError";
  }
}

// ─────────────────────────────────────────────
// 옵션 타입
// ─────────────────────────────────────────────
export interface LLMCallOptions {
  /** system prompt — 모델 페르소나 + JSON 스키마 */
  system: string;
  /** user content — 실제 분석 대상 */
  user: string;
  /** 모델 ID (기본: llama3-70b-8192) */
  model?: string;
  /** 0.0 (확정) ~ 1.0 (창의) */
  temperature?: number;
  /** 응답 최대 토큰 수 */
  maxTokens?: number;
  /** 디버그 로그용 호출 라벨 (예: "bills/describe") */
  label?: string;
}

// ─────────────────────────────────────────────
// 내부 유틸 — 마크다운 펜스 제거
// ─────────────────────────────────────────────

/**
 * LLM이 가끔 ```json … ``` 또는 ``` … ``` 로 감싼 응답을 반환할 때
 * 안쪽 JSON 본문만 추출한다. 이미 정상 JSON 이면 그대로 반환.
 *
 * 패턴:
 *   1. ```json\n{...}\n```
 *   2. ```\n{...}\n```
 *   3. {...} 앞뒤 공백/설명 텍스트
 */
export function stripMarkdownJson(raw: string): string {
  if (!raw) return raw;

  let text = raw.trim();

  // 1단계: 코드펜스 제거 — 첫 번째 ```(json)? ... 마지막 ``` 추출
  const fenceMatch = text.match(/```(?:json|javascript|js)?\s*\n?([\s\S]*?)\n?\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    text = fenceMatch[1].trim();
  }

  // 2단계: 앞뒤 비-JSON 텍스트 제거 — 첫 { ... 마지막 } 또는 [ ... ] 추출
  // (LLM이 "Here is the JSON:" 같은 prefix를 붙이는 경우)
  const jsonStart = text.search(/[{[]/);
  if (jsonStart > 0) text = text.slice(jsonStart);

  const lastClose = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (lastClose > 0 && lastClose < text.length - 1) text = text.slice(0, lastClose + 1);

  return text.trim();
}

// ─────────────────────────────────────────────
// 내부 유틸 — 재시도 / 지수 백오프
// ─────────────────────────────────────────────

function isTransient(err: any): boolean {
  // OpenAI SDK 에러 — `status` 프로퍼티 보유
  const status: number | undefined = err?.status;
  if (status) {
    if (status >= 500) return true;
    if (TRANSIENT_4XX.has(status)) return true;
    return false; // 그 외 4xx는 재시도해도 무의미
  }
  // axios/fetch 네트워크 오류
  const code: string | undefined = err?.code;
  if (["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ECONNABORTED", "EAI_AGAIN"].includes(code ?? "")) {
    return true;
  }
  // 기타 메시지 기반 휴리스틱
  const msg = String(err?.message ?? "");
  return /timeout|network|fetch failed/i.test(msg);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─────────────────────────────────────────────
// 내부 유틸 — 깊은 에러 로깅
// ─────────────────────────────────────────────

function logError(label: string, attempt: number, err: any): void {
  const status = err?.status ?? err?.response?.status ?? "?";
  const code = err?.code ?? "";
  const msg = err?.message ?? String(err);
  const body =
    typeof err?.error === "object" ? JSON.stringify(err.error).slice(0, 200) :
    typeof err?.response?.data === "object" ? JSON.stringify(err.response.data).slice(0, 200) :
    "";
  process.stderr.write(
    `  ✗ [llm:${label}] attempt=${attempt} status=${status} code=${code} msg=${msg}${body ? ` body=${body}` : ""}\n`
  );
}

// ─────────────────────────────────────────────
// 핵심 호출 함수 (내부) — chat completion 1회
// ─────────────────────────────────────────────

interface InternalCallParams extends LLMCallOptions {
  jsonMode: boolean;
}

async function callOnce(params: InternalCallParams): Promise<string> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: params.model ?? DEFAULT_MODEL,
    ...(params.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    temperature: params.temperature ?? 0.3,
    max_tokens: params.maxTokens ?? 800,
  });
  return completion.choices[0]?.message?.content ?? "";
}

/**
 * 재시도 래퍼 — transient 오류만 지수 백오프로 재시도.
 * 4xx 영구 오류는 즉시 throw, 5xx/429/네트워크 오류는 1s→2s→4s로 재시도.
 */
async function callWithRetry(params: InternalCallParams): Promise<string> {
  const label = params.label ?? "anon";
  let lastErr: any;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      return await callOnce(params);
    } catch (err) {
      lastErr = err;
      logError(label, attempt, err);

      if (!isTransient(err)) {
        // 영구 오류 — 재시도 의미 없음, 즉시 throw
        throw new LLMTransientError(
          `LLM 호출 실패 (영구 오류, status=${(err as any)?.status})`,
          (err as any)?.status
        );
      }
      if (attempt > MAX_RETRIES) break;

      const wait = BACKOFF_BASE_MS * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      process.stderr.write(`  ⚠ [llm:${label}] ${wait}ms 후 재시도 (${attempt}/${MAX_RETRIES})\n`);
      await delay(wait);
    }
  }

  throw new LLMTransientError(
    `LLM 호출 실패 (재시도 ${MAX_RETRIES}회 모두 실패)`,
    (lastErr as any)?.status
  );
}

// ─────────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────────

/**
 * 일반 텍스트 응답 호출 — JSON이 필요 없는 경우 (예: 한 문장 요약).
 *
 * @example
 *   const desc = await callLLMText({
 *     system: "당신은 법안 설명 전문가...",
 *     user: "법안명: 중대재해처벌법",
 *     maxTokens: 200,
 *     label: "bills/describe",
 *   });
 */
export async function callLLMText(options: LLMCallOptions): Promise<string> {
  const raw = await callWithRetry({ ...options, jsonMode: false });
  return raw.trim();
}

/**
 * JSON 응답 호출 + 타입 안전 파싱.
 *
 * 흐름:
 *   1. response_format=json_object 강제
 *   2. 응답 받으면 stripMarkdownJson으로 펜스/노이즈 제거
 *   3. JSON.parse 시도 — 실패 시 raw 문자열 보존한 LLMParseError throw
 *   4. 제네릭 T로 호출자가 기대하는 타입 부여 (런타임 검증은 호출자 책임)
 *
 * @example
 *   interface Result { summary: string; score: number }
 *   const r = await callLLMJson<Result>({
 *     system: "JSON 스키마: { summary: string, score: number }",
 *     user: "분석 대상 ...",
 *     label: "candidates/analyze-pledge",
 *   });
 *   // r.summary, r.score 타입 추론됨
 */
export async function callLLMJson<T = unknown>(options: LLMCallOptions): Promise<T> {
  const raw = await callWithRetry({ ...options, jsonMode: true });
  const stripped = stripMarkdownJson(raw);

  try {
    return JSON.parse(stripped) as T;
  } catch (err) {
    // 깊은 로그 — 무엇이 들어왔는지, 무엇으로 가공됐는지 모두 기록
    process.stderr.write(
      `  ✗ [llm:${options.label ?? "anon"}] JSON 파싱 실패\n` +
      `      raw(${raw.length}자): ${raw.slice(0, 300)}${raw.length > 300 ? "..." : ""}\n` +
      `      stripped(${stripped.length}자): ${stripped.slice(0, 300)}${stripped.length > 300 ? "..." : ""}\n`
    );
    throw new LLMParseError(`JSON 파싱 실패: ${(err as Error).message}`, raw);
  }
}

/**
 * JSON 호출 + 폴백 — 파싱 실패해도 호출자가 지정한 fallback 객체를 반환.
 * 사용자에게 보여줄 화면이 무조건 채워져야 하는 경우에 유용.
 *
 * @example
 *   const r = await callLLMJsonOrFallback<MyResult>(
 *     { system, user, label: "compare-pledges" },
 *     { coreContrast: "분석 실패", candidateAHighlights: [], ... }
 *   );
 */
export async function callLLMJsonOrFallback<T>(
  options: LLMCallOptions,
  fallback: T
): Promise<T> {
  try {
    return await callLLMJson<T>(options);
  } catch (err) {
    if (err instanceof LLMConfigError) throw err; // 설정 오류는 폴백 불가
    process.stderr.write(
      `  ⚠ [llm:${options.label ?? "anon"}] 폴백 사용 (${(err as Error).message})\n`
    );
    return fallback;
  }
}

/** 테스트/리셋용 — 캐시된 클라이언트 폐기 */
export function resetLLMClient(): void {
  cachedClient = null;
}
