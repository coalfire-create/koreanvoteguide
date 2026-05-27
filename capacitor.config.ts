import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.antigravity.iyu',
  appName: '이유',
  webDir: 'dist/public',
  server: process.env.CAPACITOR_LOCAL === 'true'
    ? {
        url: 'http://localhost:3000',
        cleartext: true,
      }
    : undefined,
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
