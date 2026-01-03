import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tradiemate.app',
  appName: 'TradieMate',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    // SECURITY: Only allow cleartext in development, NEVER in production
    // Production builds MUST use HTTPS only to prevent MITM attacks
    cleartext: process.env.NODE_ENV === 'development' ? true : false,
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
      // CHANGED: Use AAB (Android App Bundle) format required by Play Store
      // APK format is deprecated since August 2021
      releaseType: 'AAB',
    },
    // SECURITY: Disable mixed content to prevent HTTP resources in HTTPS app
    // This prevents downgrade attacks and ensures all resources are encrypted
    allowMixedContent: false,
    // Use new Capacitor 4+ Android plugin API
    captureInput: true,
  },
};

export default config;
