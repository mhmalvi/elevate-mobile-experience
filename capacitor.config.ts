import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tradiemate.app',
  appName: 'TradieMate',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    // Allow clear text traffic for local development
    cleartext: true,
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
    // Minimum Android version (API 22 = Android 5.1)
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
      releaseType: 'APK',
    },
    // Allow mixed content for development
    allowMixedContent: true,
    // Use new Capacitor 4+ Android plugin API
    captureInput: true,
  },
};

export default config;
