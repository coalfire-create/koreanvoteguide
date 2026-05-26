import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.antigravity.iyu',
  appName: '이유',
  webDir: 'dist/public',
  // 로컬 테스트용 IP 주소로 임시 변경 (테스트 후 원상복구 필요)
  server: {
    url: 'http://localhost:3000',
    cleartext: true,
  },
  ios: {
    backgroundColor: '#6D28D9',
    contentInset: 'always',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false,
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
