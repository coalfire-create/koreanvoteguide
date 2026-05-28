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
          url: 'https://xn--2r5b1f.com',  // 이유.com (Punycode)
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
    // WKAppBoundDomains 에 등록된 도메인만 허용 → App Store 가이드 4.2 준수
    limitsNavigationsToAppBoundDomains: true,
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
