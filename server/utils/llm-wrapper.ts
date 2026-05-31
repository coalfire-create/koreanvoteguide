/**
 * llm-wrapper.ts — 중앙 집중식 LLM 호출 유틸리티
 *
 * 모든 AI/LLM 호출은 이 파일을 경유한다. 직접 OpenAI SDK를 import 하지 말 것.
 *
 * 보장 사항:
 *   1. Strict JSON Mode    — `response_format: { type: "json_object" }` 자동 주입
 *   2. Markdown Stripping  — ```json … ``` 펜스 제거 후 안전 파싱
 *   3. Exponential Backoff — 5xx / 429 / 네트워크 오류만 재시도 (0.6s → 1.2s, 총 3회)
 *   4. Deep Error Logging  — 상태코드, 에러 본문, 파싱 실패 원본 문자열까지 stderr에 기록
 *   5. Generic Typing      — `callLLMJson<T>` 로 응답 타입 컴파일 타임 보장
 */

import OpenAI from "openai";

// ─────────────────────────────────────────────
// 환경 / 상수
// ─────────────────────────────────────────────
// 속도 최우선: Groq 최고속 모델. 더 높은 추론 품질이 필요하면 호출부에서
// model: "llama-3.3-70b-versatile" 로 개별 오버라이드.
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
// 재시도를 공격적으로 단축 — 기존(4회/2s base/429 +5s)은 rate limit 시
// 최악 ~50s 대기로 "AI가 너무 느림"의 주원인이었다. 이제 최악 ~4s.
const MAX_RETRIES = 2;            // 1차 + 재시도 2 = 총 3회
const BACKOFF_BASE_MS = 600;      // 0.6s → 1.2s
const RATE_LIMIT_EXTRA_MS = 1200; // 429 에러 시 추가 대기

// 4xx 가운데 재시도 가치가 있는 상태코드 (rate limit)
const TRANSIENT_4XX = new Set<number>([408, 425, 429]);

// ─────────────────────────────────────────────
// 클라이언트 캐싱 — 매 호출마다 new OpenAI() 하지 않도록
// ─────────────────────────────────────────────
let cachedGroqClient: OpenAI | null = null;
let cachedOpenAIClient: OpenAI | null = null;

function getClient(provider: 'openai' | 'groq'): OpenAI {
  if (provider === 'openai') {
    if (cachedOpenAIClient) return cachedOpenAIClient;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Fallback to Groq if OpenAI key is not provided yet
      const groqKey = process.env.GROQ_API_KEY;
      if (groqKey) {
        process.stderr.write("  ⚠ [llm-wrapper] OPENAI_API_KEY가 없어 GROQ로 폴백합니다.\n");
        return getClient('groq');
      }
      throw new LLMConfigError("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.");
    }
    cachedOpenAIClient = new OpenAI({ apiKey });
    return cachedOpenAIClient;
  } else {
    if (cachedGroqClient) return cachedGroqClient;
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new LLMConfigError("GROQ_API_KEY 환경변수가 설정되지 않았습니다.");
    }
    cachedGroqClient = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
    return cachedGroqClient;
  }
}

/** API_KEY 미설정 등 호출 자체가 불가능한 경우 */
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
  /** 모델 ID */
  model?: string;
  /** 0.0 (확정) ~ 1.0 (창의) */
  temperature?: number;
  /** 응답 최대 토큰 수 */
  maxTokens?: number;
  /** 디버그 로그용 호출 라벨 (예: "bills/describe") */
  label?: string;
  /** 사용할 LLM 서비스 프로바이더 ('groq' | 'openai') */
  provider?: 'openai' | 'groq';
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
  const provider = params.provider ?? 'groq';
  const client = getClient(provider);
  
  // If fallback occurred inside getClient (due to missing OPENAI_API_KEY)
  let activeProvider = provider;
  if (provider === 'openai' && !process.env.OPENAI_API_KEY && process.env.GROQ_API_KEY) {
    activeProvider = 'groq';
  }
  
  const defaultModel = activeProvider === 'openai' ? DEFAULT_OPENAI_MODEL : DEFAULT_GROQ_MODEL;
  
  const completion = await client.chat.completions.create({
    model: params.model ?? defaultModel,
    ...(params.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    temperature: params.temperature ?? 0.3,
    max_tokens: params.maxTokens ?? 800,
  });

  // 토큰 사용량 계측 — prompt/completion/total, OpenAI 자동 프롬프트 캐시 적중분(cached) 포함
  const usage = completion.usage;
  if (usage) {
    const cached = (usage as { prompt_tokens_details?: { cached_tokens?: number } })
      .prompt_tokens_details?.cached_tokens ?? 0;
    process.stderr.write(
      `  ◆ [llm:${params.label ?? "anon"}] tokens model=${completion.model}` +
      ` prompt=${usage.prompt_tokens} completion=${usage.completion_tokens}` +
      ` total=${usage.total_tokens}${cached ? ` cached=${cached}` : ""}\n`
    );
  }

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

      // 429(rate limit) 시에는 추가 대기를 부여해 Groq 할당량 회복을 기다린다
      const is429 = (err as any)?.status === 429;
      const baseWait = BACKOFF_BASE_MS * Math.pow(2, attempt - 1); // 0.6s, 1.2s
      const wait = is429 ? baseWait + RATE_LIMIT_EXTRA_MS : baseWait;
      process.stderr.write(`  ⚠ [llm:${label}] ${wait}ms 후 재시도 (${attempt}/${MAX_RETRIES})${is429 ? ' [429 rate limit]' : ''}\n`);
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
 */
export async function callLLMText(options: LLMCallOptions): Promise<string> {
  const raw = await callWithRetry({ ...options, jsonMode: false });
  return raw.trim();
}

/**
 * JSON 응답 호출 + 타입 안전 파싱.
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
  cachedGroqClient = null;
  cachedOpenAIClient = null;
}
