import axios from "axios";

// Kakao OAuth helper — 토큰 교환·프로필 조회·age_range 매핑.
// 환경변수:
//   KAKAO_REST_API_KEY  (필수) — REST API 키 (kapi.kakao.com 인증용)
//   KAKAO_REDIRECT_URI  (필수) — Kakao 개발자센터에 등록한 redirect URI와 100% 일치해야 함
//   KAKAO_CLIENT_SECRET (선택) — 사용 설정한 경우만 필요

const AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize";
const TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const USER_ME_URL = "https://kapi.kakao.com/v2/user/me";

export interface KakaoConfig {
  restApiKey: string;
  redirectUri: string;
  clientSecret?: string;
}

export function loadKakaoConfig(): KakaoConfig | null {
  const restApiKey = process.env.KAKAO_REST_API_KEY;
  const redirectUri = process.env.KAKAO_REDIRECT_URI;
  if (!restApiKey || !redirectUri) return null;
  return {
    restApiKey,
    redirectUri,
    clientSecret: process.env.KAKAO_CLIENT_SECRET,
  };
}

// Kakao 인증 URL — state는 CSRF 방지용. scope는 필요한 사용자 정보 동의 항목.
// account_email/age_range/gender/birthyear는 Kakao 개발자센터에서 "선택 동의"로 설정 필요.
export function buildAuthorizeUrl(config: KakaoConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.restApiKey,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: [
      "profile_nickname",
      "profile_image",
      "account_email",
      "age_range",
      "gender",
      "birthyear",
    ].join(","),
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  refresh_token_expires_in: number;
}

export async function exchangeCodeForToken(config: KakaoConfig, code: string): Promise<KakaoTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.restApiKey,
    redirect_uri: config.redirectUri,
    code,
  });
  if (config.clientSecret) body.append("client_secret", config.clientSecret);

  const { data } = await axios.post<KakaoTokenResponse>(TOKEN_URL, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    timeout: 10_000,
  });
  return data;
}

// /v2/user/me 응답의 필요한 필드만 추출한 형태.
// kakao_account의 각 필드는 사용자 동의 여부에 따라 부재할 수 있음 — 모두 optional.
export interface KakaoProfile {
  id: number; // Kakao 고유 ID
  properties?: {
    nickname?: string;
    profile_image?: string;
    thumbnail_image?: string;
  };
  kakao_account?: {
    email?: string;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
    age_range?: string; // "0~9" | "10~14" | "15~19" | "20~29" | ... | "80~89" | "90~"
    gender?: "male" | "female";
    birthyear?: string; // "YYYY"
    profile?: {
      nickname?: string;
      profile_image_url?: string;
      thumbnail_image_url?: string;
    };
  };
}

export async function fetchKakaoProfile(accessToken: string): Promise<KakaoProfile> {
  const { data } = await axios.get<KakaoProfile>(USER_ME_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    timeout: 10_000,
  });
  return data;
}

// ===== age_range → ageGroup 매핑 =====
// Kakao는 5세 단위로 쪼개진 10대(10~14, 15~19)와 10세 단위 그 외 버킷을 돌려준다.
// 우리 DB의 ageGroup은 10/20/30/40/50/60(60 이상 캡). 따라서:
//   "0~9"       → 0  (가입 불가 영역. null 반환해 호출측이 거부)
//   "10~14"     → 10
//   "15~19"     → 10
//   "20~29"     → 20
//   "30~39"     → 30
//   "40~49"     → 40
//   "50~59"     → 50
//   "60~69"     → 60
//   "70~79"     → 60 (60 이상 모두 60으로 캡)
//   "80~89"     → 60
//   "90~"       → 60
// 동의 거부로 age_range가 부재하면 null 반환 — 호출측에서 ageGroup 미설정 처리.
export function mapKakaoAgeRange(ageRange: string | null | undefined): number | null {
  if (!ageRange) return null;
  // 첫 숫자 시퀀스를 추출 (예: "20~29" → 20, "90~" → 90)
  const match = ageRange.match(/^(\d+)/);
  if (!match) return null;
  const lower = Number(match[1]);
  if (!Number.isFinite(lower)) return null;
  if (lower < 10) return null;     // 14세 미만 가입 차단
  if (lower >= 60) return 60;
  // 10~14, 15~19 둘 다 10대 → Math.floor(lower / 10) * 10
  return Math.floor(lower / 10) * 10;
}

export function mapKakaoGender(gender: string | null | undefined): "M" | "F" | null {
  if (gender === "male") return "M";
  if (gender === "female") return "F";
  return null;
}

export function mapKakaoBirthYear(birthyear: string | null | undefined): number | null {
  if (!birthyear) return null;
  const n = parseInt(birthyear, 10);
  if (!Number.isFinite(n) || n < 1900 || n > new Date().getFullYear()) return null;
  return n;
}
