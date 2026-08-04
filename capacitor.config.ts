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
    // Chrome colours must match the app shell. They previously did not:
    // splash and status bar were #1a1a1a (neutral grey), the spinner was
    // #3b82f6 (Tailwind blue — a colour that appears nowhere in the brand),
    // and the app itself opens on #002420 (dark teal). The result was a grey
    // screen with a blue spinner snapping to dark teal — the first three
    // seconds of every launch and the first impression of every install.
    //
    // #002420 == --background (dark) in src/index.css
    // #FF9514 == --primary    (dark) in src/index.css
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#002420',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      iosSpinnerStyle: 'small',
      spinnerColor: '#FF9514',
      launchAutoHide: true,
    },
    StatusBar: {
      // Capacitor's Style.Dark means "light text, for a dark background",
      // which is what this app's default dark theme needs.
      style: 'dark',
      backgroundColor: '#002420',
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
