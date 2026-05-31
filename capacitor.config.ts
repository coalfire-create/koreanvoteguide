import { CapacitorConfig } from '@capacitor/cli';

const isProd = process.env.CAPACITOR_PROD === 'true';

const config: CapacitorConfig = {
  appId: 'com.antigravity.iyu',
  appName: '이유',
  webDir: 'dist/public',
  // CAPACITOR_PROD=true 로 build/sync 하면 server.url 을 이유.com 으로 고정
  // → 모든 API/OAuth/세션이 서버와 같은 origin에서 동작 (SameSite 쿠키 정상 동작)
  // 개발 시(CAPACITOR_PROD 미설정): localhost:3000 에서 직접 로드
  server: {
    ...(isProd
      ? {
          // www 서브도메인으로 직접 — root 도메인은 301 redirect 되는데
          // limitsNavigationsToAppBoundDomains: true 일 때 redirect chain 에서 막힐 수 있음.
          url: 'https://www.xn--2r5b1f.com',
          cleartext: false,
        }
      : {
          url: 'http://localhost:3000',
          cleartext: true,
        }),
    allowNavigation: ['xn--2r5b1f.com', '*.xn--2r5b1f.com', 'localhost'],
  },
  ios: {
    backgroundColor: '#000000',
    contentInset: 'automatic',
    scrollEnabled: true,
    // App Bound Domains 는 프로덕션 빌드에서만 활성화 (App Store 가이드 4.2 준수).
    // 개발 빌드(localhost:3000)에서는 비활성 — Apple WK 가 'localhost' 를 valid
    // app-bound domain 으로 받지 않아 강제 시 모든 네비게이션이 차단되어 흰화면 발생.
    limitsNavigationsToAppBoundDomains: isProd,
  },
  plugins: {
    PushNotifications: {
      // 포그라운드에서도 배너+사운드로 표시 (4.2 네이티브 경험 강조)
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      // 검정 스플래시 + 안전장치: JS(main.tsx)가 SplashScreen.hide()를 호출하지만,
      // dev 서버 미도달 등으로 JS가 안 돌면 launchAutoHide:false 일 때 스플래시에
      // 영구 고정된다(보라/검정 화면에서 멈춤). → autoHide:true 로 1.5s 후 자동 해제.
      launchShowDuration: 1500,
      backgroundColor: '#000000',
      showSpinner: false,
      launchAutoHide: true,
      iosSpinnerStyle: 'small',
      spinnerColor: '#FFFFFF',
    },
  },
};

export default config;
