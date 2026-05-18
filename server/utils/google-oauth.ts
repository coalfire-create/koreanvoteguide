import axios from "axios";

// Google OAuth helper — 토큰 교환·프로필 조회. kakao-oauth.ts 및 naver-oauth.ts와 동일 구조.
// 환경변수:
//   GOOGLE_CLIENT_ID     (필수) — 구글 개발자 콘솔에서 발급한 Client ID
//   GOOGLE_CLIENT_SECRET (필수) — Client Secret
//   GOOGLE_REDIRECT_URI  (필수) — 구글 개발자 콘솔에 등록한 redirect URI와 100% 일치해야 함

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USER_INFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function loadGoogleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

// Google 인증 URL — state는 CSRF 방지용.
export function buildAuthorizeUrl(config: GoogleConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online", // 로그인 인증용이므로 online도 충분함
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

export async function exchangeCodeForToken(config: GoogleConfig, code: string): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code,
  });

  const { data } = await axios.post<GoogleTokenResponse>(TOKEN_URL, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 10_000,
  });
  return data;
}

export interface GoogleProfile {
  id: string; // Google 고유 ID
  email?: string;
  verified_email?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const { data } = await axios.get<GoogleProfile>(USER_INFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    timeout: 10_000,
  });
  return data;
}
