import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tradiemate.app',
  appName: 'TradieMate',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    // SECURITY: Always false — cleartext is blocked at OS level via
    // network_security_config.xml (Android) and ATS (iOS).
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a1a',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      iosSpinnerStyle: 'small',
      spinnerColor: '#3b82f6',
      launchAutoHide: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1a1a1a',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  // iOS specific configuration
  ios: {
    contentInset: 'always',
    // Scheme for deep linking
    scheme: 'tradiemate',
  },
  // Android specific configuration
  android: {
    buildOptions: {
      releaseType: 'AAB',
    },
    allowMixedContent: false,
    captureInput: true,
  },
};

export default config;
