import type { CapacitorConfig } from '@capacitor/cli';

// iOS/Android shell configuration.
//
// The app bundles the built web assets (dist/public) — no server.url — so
// the client MUST be built with the production API address baked in:
//
//   VITE_API_URL=https://www.fusioncouples.co.uk npm run build
//   npx cap sync ios
//
// (The web deployment on Replit builds WITHOUT VITE_API_URL — it talks to
// its own origin. Only native shell builds set it.)
const config: CapacitorConfig = {
  appId: 'com.gajocreative.fusion',
  appName: 'Fusion',
  webDir: 'dist/public',

  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a1628',
      showSpinner: false,
    },
  },

  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0a1628',
  },

  android: {
    backgroundColor: '#0a1628',
  },
};

export default config;
