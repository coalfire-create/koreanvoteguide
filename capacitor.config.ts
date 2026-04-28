import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.antigravity.iyu',
  appName: '안티그래비티',
  webDir: 'dist/public',
  server: {
    // 개발 시 로컬 서버로 연결 (배포 시 이 블록 전체 제거)
    // url: 'http://192.168.x.x:3000',
    // cleartext: true,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#425091',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#425091',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
