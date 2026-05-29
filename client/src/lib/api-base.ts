import { Capacitor } from "@capacitor/core";

// Native(Capacitor) 빌드는 capacitor://localhost/ 에서 번들 자산을 로드한다.
// 이 컨텍스트에서 fetch("/api/...") 는 capacitor 스킴을 가리키므로 서버에 도달하지 못한다.
// → native 일 때만 relative API URL 을 절대 URL 로 재작성하는 전역 fetch 인터셉터를 설치.
//
// API base 우선순위:
//   1) VITE_API_BASE_URL (빌드 타임 env, 프로덕션 배포 URL 지정용)
//   2) http://localhost:3000 (dev/시뮬레이터 기본값 — Mac 호스트와 네트워크 공유)
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "")
  || "http://localhost:3000";

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function shouldRewrite(url: string): boolean {
  if (!url) return false;
  // 이미 절대 URL(http/https) 이면 그대로 둔다.
  if (/^https?:\/\//i.test(url)) return false;
  // data:, blob:, file:, capacitor: 등 다른 스킴도 건드리지 않는다.
  if (/^[a-z][a-z0-9+\-.]*:/i.test(url)) return false;
  // 같은 origin 의 자산( /assets/..., /uploads/..., /api/... )만 재작성 대상.
  return url.startsWith("/");
}

export function withApiBase(url: string): string {
  if (!isNative() || !shouldRewrite(url)) return url;
  
  if (typeof window !== "undefined") {
    // 만약 WebView가 원격 서버(이유.com)를 직접 로드하고 있다면, 상대 경로가 정상 동작하므로 재작성 불필요
    const isLocalOrigin = window.location.protocol === "capacitor:" || window.location.hostname === "localhost";
    if (!isLocalOrigin) {
      return url;
    }
  }
  
  return `${API_BASE}${url}`;
}

let installed = false;

/** native 컨텍스트에서 relative URL fetch 를 API_BASE 로 재작성. 웹에선 no-op. */
export function installFetchInterceptor() {
  if (installed || typeof window === "undefined") return;
  if (!isNative()) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    // credentials: "include" 를 native 에서도 강제 — 세션 쿠키 전송 보장.
    const mergedInit: RequestInit = { credentials: "include", ...init };

    if (typeof input === "string") {
      return originalFetch(withApiBase(input), mergedInit);
    }
    if (input instanceof URL) {
      const s = input.toString();
      return originalFetch(shouldRewrite(s) ? withApiBase(s) : input, mergedInit);
    }
    // Request 객체: url 이 이미 절대화돼 있을 수 있어 그대로 위임.
    return originalFetch(input, mergedInit);
  }) as typeof window.fetch;
}

export const apiBaseUrl = API_BASE;
