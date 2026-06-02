import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { SplashScreen } from "@capacitor/splash-screen";
import { installFetchInterceptor } from "./lib/api-base";
import { registerNativeAuthListener } from "./lib/native-auth";

// React 트리 렌더 전에 설치 — 첫 useQuery 가 발사되기 전에 전역 fetch 가 패치돼야 한다.
installFetchInterceptor();

// 네이티브 앱: 시스템 브라우저 소셜 로그인 후 돌아오는 iyu://auth 딥링크 처리기 등록.
registerNativeAuthListener();

// Google Analytics (GA4) 동적 연동
// gtag 초기화는 인라인 <script> 주입 대신 번들 모듈('self') 안에서 직접 실행한다.
// → CSP에 script-src 'unsafe-inline'을 추가하지 않아도 동작 (XSS 방어 유지).
const gaId = import.meta.env.VITE_GA_ID;
if (gaId) {
  const gtagScript = document.createElement("script");
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(gtagScript);

  const w = window as unknown as { dataLayer: unknown[]; gtag: (...args: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments);
  };
  w.gtag("js", new Date());
  w.gtag("config", gaId);
}

createRoot(document.getElementById("root")!).render(<App />);
SplashScreen.hide();
