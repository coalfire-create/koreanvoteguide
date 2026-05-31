// APNs(Apple Push Notification service) 발송 — 토큰 기반 인증(.p8 키).
//
// 필요한 환경변수:
//   APNS_KEY_ID        Apple Developer → Keys 에서 발급한 .p8 Key ID
//   APNS_TEAM_ID       Apple Developer Team ID
//   APNS_PRIVATE_KEY   .p8 파일 내용(-----BEGIN PRIVATE KEY----- ...). 개행은 \n 로 저장 가능.
//   APNS_TOPIC         앱 번들 ID (예: com.antigravity.iyu)
//   APNS_PRODUCTION    "true" 면 운영(api.push.apple.com), 아니면 샌드박스
//
// 미설정 시 sendPush 는 조용히 no-op(개발/미연동 환경에서 크래시 방지).

import http2 from "node:http2";
import { SignJWT, importPKCS8 } from "jose";

const KEY_ID = process.env.APNS_KEY_ID;
const TEAM_ID = process.env.APNS_TEAM_ID;
const TOPIC = process.env.APNS_TOPIC || "com.antigravity.iyu";
const RAW_KEY = process.env.APNS_PRIVATE_KEY;
const HOST = process.env.APNS_PRODUCTION === "true"
  ? "https://api.push.apple.com"
  : "https://api.sandbox.push.apple.com";

export function isApnsConfigured(): boolean {
  return Boolean(KEY_ID && TEAM_ID && RAW_KEY);
}

// 프로바이더 JWT는 최대 1시간 유효 — 50분 캐시 후 재발급.
let cachedJwt: { token: string; createdAt: number } | null = null;

async function getProviderToken(): Promise<string> {
  if (cachedJwt && Date.now() - cachedJwt.createdAt < 50 * 60 * 1000) {
    return cachedJwt.token;
  }
  const pkcs8 = (RAW_KEY as string).replace(/\\n/g, "\n");
  const key = await importPKCS8(pkcs8, "ES256");
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: KEY_ID as string })
    .setIssuer(TEAM_ID as string)
    .setIssuedAt()
    .sign(key);
  cachedJwt = { token, createdAt: Date.now() };
  return token;
}

export interface PushPayload {
  title: string;
  body: string;
  /** 탭 시 앱이 열 딥링크 경로(예: "/bills/123") */
  link?: string;
  data?: Record<string, string>;
}

interface SendResult { sent: number; failed: number; invalidTokens: string[] }

/**
 * 다수 디바이스 토큰에 동일 알림 발송. 410/BadDeviceToken 응답은 무효 토큰으로 수집(호출부에서 정리).
 */
export async function sendPush(tokens: string[], payload: PushPayload): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0, invalidTokens: [] };
  if (!isApnsConfigured() || tokens.length === 0) return result;

  const jwt = await getProviderToken();
  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: "default",
    },
    ...(payload.link ? { link: payload.link } : {}),
    ...(payload.data ?? {}),
  });

  const client = http2.connect(HOST);
  // 연결 단위 에러로 프로세스가 죽지 않도록
  client.on("error", () => {});

  try {
    await Promise.all(
      tokens.map(
        (token) =>
          new Promise<void>((resolve) => {
            const req = client.request({
              ":method": "POST",
              ":path": `/3/device/${token}`,
              authorization: `bearer ${jwt}`,
              "apns-topic": TOPIC,
              "apns-push-type": "alert",
              "content-type": "application/json",
            });
            let status = 0;
            let respBody = "";
            req.on("response", (headers) => {
              status = Number(headers[":status"]) || 0;
            });
            req.setEncoding("utf8");
            req.on("data", (chunk) => { respBody += chunk; });
            req.on("end", () => {
              if (status === 200) {
                result.sent++;
              } else {
                result.failed++;
                // 만료/무효 토큰 정리 대상
                if (status === 410 || /BadDeviceToken|Unregistered/.test(respBody)) {
                  result.invalidTokens.push(token);
                }
              }
              resolve();
            });
            req.on("error", () => { result.failed++; resolve(); });
            req.end(body);
          }),
      ),
    );
  } finally {
    client.close();
  }
  return result;
}
