// Sentry/OpenTelemetry 등 에러 모니터링 진입점.
// 패키지를 따로 설치하지 않고도 동작하도록 lazy require로 감싼다.
// SENTRY_DSN 환경변수가 있고 @sentry/node가 설치되어 있으면 활성화된다.

let sentry: any = null;

export function initMonitoring(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    // dynamic require — 미설치 시 그냥 비활성화
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sentry = require("@sentry/node");
    sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
    console.log("[monitoring] Sentry initialized");
  } catch {
    console.warn("[monitoring] SENTRY_DSN 설정되어 있지만 @sentry/node가 설치되지 않았습니다. `npm i @sentry/node` 후 재시작하세요.");
  }
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!sentry) return;
  try {
    sentry.captureException(err, { extra: context });
  } catch {
    // monitoring 자체가 실패해도 앱은 계속 동작
  }
}

export function flush(timeoutMs = 2000): Promise<void> {
  if (!sentry) return Promise.resolve();
  return sentry.flush(timeoutMs).then(() => undefined).catch(() => undefined);
}
