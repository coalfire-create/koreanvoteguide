import axios from "axios";

// Naver OAuth helper — 토큰 교환·프로필 조회·age 매핑. kakao-oauth.ts와 동일 구조.
// 환경변수:
//   NAVER_CLIENT_ID     (필수) — 네이버 개발자센터 애플리케이션 Client ID
//   NAVER_CLIENT_SECRET (필수) — Client Secret
//   NAVER_REDIRECT_URI  (필수) — 네이버 개발자센터에 등록한 Callback URL과 100% 일치해야 함

const AUTHORIZE_URL = "https://nid.naver.com/oauth2.0/authorize";
const TOKEN_URL = "https://nid.naver.com/oauth2.0/token";
const USER_ME_URL = "https://openapi.naver.com/v1/nid/me";

export interface NaverConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function loadNaverConfig(): NaverConfig | null {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  const redirectUri = process.env.NAVER_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

// 네이버 인증 URL — state는 CSRF 방지용. 네이버는 scope를 콘솔의 "동의 항목"으로 제어한다.
export function buildAuthorizeUrl(config: NaverConfig, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface NaverTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: string;
  error?: string;
  error_description?: string;
}

export async function exchangeCodeForToken(
  config: NaverConfig,
  code: string,
  state: string,
): Promise<NaverTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code,
    state,
  });
  // 네이버 토큰 엔드포인트는 GET 쿼리스트링 방식.
  const { data } = await axios.get<NaverTokenResponse>(`${TOKEN_URL}?${params.toString()}`, {
    timeout: 10_000,
  });
  if (data.error || !data.access_token) {
    throw new Error(`Naver token error: ${data.error ?? "no_access_token"} ${data.error_description ?? ""}`);
  }
  return data;
}

// /v1/nid/me 응답. response의 각 필드는 사용자 동의 여부에 따라 부재할 수 있음 — 모두 optional.
export interface NaverProfile {
  resultcode: string;
  message: string;
  response: {
    id: string; // 네이버 고유 식별자 (앱별 고유)
    nickname?: string;
    name?: string;
    email?: string;
    gender?: "M" | "F" | "U";
    age?: string; // "20-29", "30-39", "0-9", "60-" 등 범위 문자열
    birthyear?: string; // "YYYY"
    birthday?: string; // "MM-DD"
    profile_image?: string;
    mobile?: string;
  };
}

export async function fetchNaverProfile(accessToken: string): Promise<NaverProfile> {
  const { data } = await axios.get<NaverProfile>(USER_ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10_000,
  });
  if (data.resultcode !== "00") {
    throw new Error(`Naver profile error: ${data.resultcode} ${data.message}`);
  }
  return data;
}

// ===== age("20-29") → ageGroup 매핑 =====
// 우리 DB ageGroup은 10/20/30/40/50/60(60 이상 캡). kakao와 동일 규칙.
//   "0-9"  → null (14세 미만 가입 차단)
//   "10-19"→ 10, "20-29"→ 20, ... "50-59"→ 50, "60-69"/"60-"→ 60
export function mapNaverAge(age: string | null | undefined): number | null {
  if (!age) return null;
  const match = age.match(/^(\d+)/);
  if (!match) return null;
  const lower = Number(match[1]);
  if (!Number.isFinite(lower)) return null;
  if (lower < 10) return null;
  if (lower >= 60) return 60;
  return Math.floor(lower / 10) * 10;
}

export function mapNaverGender(gender: string | null | undefined): "M" | "F" | null {
  if (gender === "M") return "M";
  if (gender === "F") return "F";
  return null;
}

export function mapNaverBirthYear(birthyear: string | null | undefined): number | null {
  if (!birthyear) return null;
  const n = parseInt(birthyear, 10);
  if (!Number.isFinite(n) || n < 1900 || n > new Date().getFullYear()) return null;
  return n;
}
