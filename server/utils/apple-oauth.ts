import axios from "axios";
import { SignJWT, importPKCS8, jwtVerify, createRemoteJWKSet } from "jose";

// Sign in with Apple helper — google-oauth.ts / kakao-oauth.ts 와 동일 구조.
// 애플은 client_secret이 .p8 개인키로 ES256 서명한 JWT 라는 점, 그리고 동의 콜백이
// scope 요청 시 form_post(POST) 로 온다는 점이 다르다.
//
// 환경변수:
//   APPLE_SERVICE_ID  (필수) — Apple Developer의 Services ID (OAuth client_id 역할). 예) com.antigravity.iyu.service
//   APPLE_TEAM_ID     (필수) — Apple Developer 팀 ID(10자)
//   APPLE_KEY_ID      (필수) — Sign in with Apple 키(.p8)의 Key ID
//   APPLE_PRIVATE_KEY (필수) — .p8 파일 내용(PEM, "-----BEGIN PRIVATE KEY-----" 포함). 개행은 \n 또는 실제 줄바꿈 허용
//   APPLE_REDIRECT_URI(필수) — Apple Developer에 등록한 Return URL과 100% 일치. 예) https://이유.com/api/auth/apple/callback

const AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize";
const TOKEN_URL = "https://appleid.apple.com/auth/token";
const ISSUER = "https://appleid.apple.com";
const JWKS_URL = "https://appleid.apple.com/auth/keys";

// Apple 공개키(JWKS) 캐시 — id_token 서명 검증용. jose가 내부적으로 캐시/회전을 관리한다.
const appleJwks = createRemoteJWKSet(new URL(JWKS_URL));

export interface AppleConfig {
  serviceId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
  redirectUri: string;
}

export function loadAppleConfig(): AppleConfig | null {
  const serviceId = process.env.APPLE_SERVICE_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  // 환경변수에 \n 으로 들어온 줄바꿈을 실제 개행으로 복원
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const redirectUri = process.env.APPLE_REDIRECT_URI;
  if (!serviceId || !teamId || !keyId || !privateKey || !redirectUri) return null;
  return { serviceId, teamId, keyId, privateKey, redirectUri };
}

// Apple 인증 URL. scope를 요청하면 콜백이 반드시 form_post(POST)로 온다.
export function buildAuthorizeUrl(config: AppleConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.serviceId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "name email",
    state,
    response_mode: "form_post",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// client_secret 생성 — .p8 개인키로 ES256 서명한 JWT (애플 사양상 최대 6개월 유효, 여기선 5분).
async function generateClientSecret(config: AppleConfig): Promise<string> {
  const privateKey = await importPKCS8(config.privateKey, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .setAudience(ISSUER)
    .setSubject(config.serviceId)
    .sign(privateKey);
}

export interface AppleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token: string;
}

export async function exchangeCodeForToken(config: AppleConfig, code: string): Promise<AppleTokenResponse> {
  const clientSecret = await generateClientSecret(config);
  const body = new URLSearchParams({
    client_id: config.serviceId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });
  const { data } = await axios.post<AppleTokenResponse>(TOKEN_URL, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 10_000,
  });
  return data;
}

export interface AppleProfile {
  /** Apple 고유 사용자 식별자(id_token의 sub). 재로그인 lookup 키. */
  sub: string;
  email?: string;
  emailVerified?: boolean;
}

// id_token(JWT)을 Apple 공개키로 검증하고 sub/email 추출.
export async function verifyIdToken(config: AppleConfig, idToken: string): Promise<AppleProfile> {
  const { payload } = await jwtVerify(idToken, appleJwks, {
    issuer: ISSUER,
    audience: config.serviceId,
  });
  const emailVerifiedRaw = payload.email_verified;
  return {
    sub: String(payload.sub),
    email: typeof payload.email === "string" ? payload.email : undefined,
    emailVerified: emailVerifiedRaw === true || emailVerifiedRaw === "true",
  };
}
