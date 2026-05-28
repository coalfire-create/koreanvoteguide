import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.antigravity.iyu',
  appName: '이유',
  webDir: 'dist/public',
  // dev/시뮬레이터 기본: WebView 가 dev 서버에서 자산을 직접 로드 (same-origin → mixed-content 회피).
  // App Store/프로덕션 빌드 시에는 CAPACITOR_PROD=true 로 sync 해서 server.url 제거 + 번들 자산 사용.
  // (그 경우 client/src/lib/api-base.ts 의 fetch 인터셉터 + <img> withApiBase 가 절대 URL 로 라우팅)
  server: process.env.CAPACITOR_PROD === 'true'
    ? undefined
    : {
        url: 'http://localhost:3000',
        cleartext: true,
      },
  ios: {
    backgroundColor: '#FFFFFF',
    contentInset: 'always',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0F172A',
      showSpinner: false,
      launchAutoHide: true,
      iosSpinnerStyle: 'small',
      spinnerColor: '#FFFFFF',
    },
  },
};

export default config;
