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
    backgroundColor: '#FFFFFF',
    contentInset: 'always',
    scrollEnabled: true,
    // App Bound Domains 는 프로덕션 빌드에서만 활성화 (App Store 가이드 4.2 준수).
    // 개발 빌드(localhost:3000)에서는 비활성 — Apple WK 가 'localhost' 를 valid
    // app-bound domain 으로 받지 않아 강제 시 모든 네비게이션이 차단되어 흰화면 발생.
    limitsNavigationsToAppBoundDomains: isProd,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0F172A',
      showSpinner: false,
      launchAutoHide: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#FFFFFF',
    },
  },
};

export default config;
