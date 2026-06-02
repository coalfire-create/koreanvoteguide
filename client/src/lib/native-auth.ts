// 네이티브(Capacitor) 앱 소셜 로그인 핸드오프.
//
// 웹뷰 안에서 구글/애플 OAuth로 직접 이동하면 ① App-Bound Domains 로 외부 도메인 이동이
// 차단되고 ② 구글은 임베디드 웹뷰 OAuth(disallowed_useragent)를 막는다.
// → 시스템 브라우저(SFSafariViewController)로 OAuth를 열고, 서버가 끝에 iyu://auth?code=...
//   딥링크로 1회용 코드를 돌려주면, 앱이 그 코드를 웹뷰 세션으로 교환한다.

import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";

export type SocialProvider = "kakao" | "google" | "apple";

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** 웹뷰가 로드 중인 서버 origin (예: https://www.xn--2r5b1f.com). */
function serverOrigin(): string {
  return window.location.origin;
}

/** 소셜 로그인 버튼이 네이티브에서 호출 — 시스템 브라우저로 OAuth 열기. */
export async function openNativeSocialLogin(provider: SocialProvider, next?: string): Promise<void> {
  const params = new URLSearchParams({ native: "1" });
  if (next) params.set("next", next);
  await Browser.open({ url: `${serverOrigin()}/api/auth/${provider}?${params.toString()}` });
}

let registered = false;

/** 앱 시작 시 1회 등록: iyu://auth?code=... 딥링크 → 코드 교환 → 홈 이동. */
export function registerNativeAuthListener(): void {
  if (registered || !isNativeApp()) return;
  registered = true;

  void App.addListener("appUrlOpen", async ({ url }) => {
    if (!url || !url.startsWith("iyu://auth")) return;
    const m = url.match(/[?&]code=([^&]+)/);
    const code = m ? decodeURIComponent(m[1]) : null;

    // 시스템 브라우저 시트 닫기 (실패해도 무시)
    await Browser.close().catch(() => {});
    if (!code) return;

    try {
      const res = await fetch(`${serverOrigin()}/api/auth/native-exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        // 세션 쿠키가 웹뷰에 저장됨 — 홈으로 전체 리로드해 로그인 상태 반영
        window.location.href = "/";
      }
    } catch {
      // 네트워크 오류 등 — 조용히 무시 (사용자는 다시 시도 가능)
    }
  });
}
