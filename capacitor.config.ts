import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.antigravity.iyu',
  appName: '이유',
  webDir: 'dist/public',
  // 프로덕션 서버 URL — 앱은 번들을 직접 서빙하지 않고 배포된 서버에서 로드
  server: {
    url: 'https://이유.com',
    cleartext: false,
  },
  ios: {
    backgroundColor: '#6D28D9',
    contentInset: 'always',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#6D28D9',
      showSpinner: false,
      launchAutoHide: true,
      iosSpinnerStyle: 'small',
      spinnerColor: '#FFFFFF',
    },
  },
};

export default config;
