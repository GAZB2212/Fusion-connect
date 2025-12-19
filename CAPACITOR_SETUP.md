# Capacitor Setup Guide for Fusion

This guide explains how to wrap Fusion as a native iOS/Android app using Capacitor.

## Prerequisites

- **Node.js** 18+ installed locally
- **Apple Developer Account** ($99/year) for iOS
- **Xcode** 15+ (Mac only, required for iOS)
- **Android Studio** (for Android builds)

## Step 1: Clone and Build

```bash
# Clone your Replit project locally or export it
git clone <your-repo-url>
cd fusion

# Install dependencies
npm install

# Build the web app
npm run build
```

## Step 2: Install Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Fusion" "com.fusioncouples.app" --web-dir dist/public
```

## Step 3: Create capacitor.config.ts

Create a file called `capacitor.config.ts` in your project root:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fusioncouples.app',
  appName: 'Fusion',
  webDir: 'dist/public',
  
  // For development, use live reload from your Replit URL
  // Comment this out for production builds
  server: {
    url: 'https://your-app.replit.app',
    cleartext: true
  },
  
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a1628',
      showSpinner: false
    }
  },
  
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0a1628'
  },
  
  android: {
    backgroundColor: '#0a1628'
  }
};

export default config;
```

## Step 4: Add Platforms

```bash
# Add iOS
npx cap add ios

# Add Android (optional)
npx cap add android
```

## Step 5: Install Required Plugins

```bash
# Push Notifications
npm install @capacitor/push-notifications

# Camera (for profile photos)
npm install @capacitor/camera

# Status Bar
npm install @capacitor/status-bar

# Splash Screen
npm install @capacitor/splash-screen
```

## Step 6: iOS Configuration

### Update Info.plist

Open `ios/App/App/Info.plist` and add these permissions:

```xml
<key>NSCameraUsageDescription</key>
<string>Fusion needs camera access for profile photos and video calls</string>

<key>NSMicrophoneUsageDescription</key>
<string>Fusion needs microphone access for video calls</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Fusion needs photo library access for profile photos</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>Fusion needs access to save photos to your library</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>Fusion uses your location to find matches near you</string>
```

### Configure Push Notifications

1. Go to Apple Developer Portal
2. Create an App ID with Push Notifications capability
3. Create a Push Notification certificate or key
4. Add the Push Notifications capability in Xcode

## Step 7: Sync and Build

```bash
# Sync web assets to native projects
npx cap sync

# Open in Xcode
npx cap open ios

# Or open in Android Studio
npx cap open android
```

## Step 8: App Store Assets Needed

You'll need to create:

1. **App Icons** - Multiple sizes (see `public/icons/` for required sizes)
   - 1024x1024 for App Store
   - Various sizes for iOS (20, 29, 40, 60, 76, 83.5, 1024 points)
   
2. **Splash Screen** - Various device sizes
   
3. **Screenshots** - For App Store listing
   - iPhone 6.7" (1290 x 2796)
   - iPhone 6.5" (1284 x 2778)
   - iPhone 5.5" (1242 x 2208)
   - iPad Pro 12.9" (2048 x 2732)

4. **App Preview Video** (optional but recommended)

## What's Already Configured in Fusion

- Platform detection (`client/src/lib/platform.ts`)
- Unified push notifications for web/iOS/Android
- Mobile-optimized viewport and meta tags
- PWA manifest
- Service worker for offline support
- Safe area insets for notched devices
- App Store compliance (privacy policy, terms, reporting, blocking)

## Development vs Production

### Development Mode
Keep the `server.url` in capacitor.config.ts pointing to your Replit URL. This allows live updates without rebuilding.

### Production Mode
1. Comment out or remove the `server` block in capacitor.config.ts
2. Run `npm run build` to create production assets
3. Run `npx cap sync` to copy to native projects
4. Build in Xcode/Android Studio

## Troubleshooting

### Push Notifications Not Working
- Ensure APNs certificate is properly configured
- Check that the app has notification permissions
- Verify the push token is being saved to the server

### Camera/Photos Not Working
- Check Info.plist permissions are added
- Ensure privacy descriptions are clear

### Video Calls Not Working
- Agora requires specific iOS configurations
- Add `NSMicrophoneUsageDescription` to Info.plist
- May need to add Agora's required frameworks

## Support

For issues specific to Capacitor, see: https://capacitorjs.com/docs
