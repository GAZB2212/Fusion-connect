# Fusion — React Native app

The native iOS/Android app, rebuilt in **Expo (React Native)**, talking to the
existing Fusion backend (`server/`) over its REST + WebSocket API. This replaces
the old Capacitor wrapper.

- **Framework:** Expo SDK 52 + Expo Router (file-based routing)
- **Backend:** unchanged — `https://www.fusioncouples.co.uk`
- **Bundle ID:** `com.gajocreative.fusion` (same App Store record as before)
- **Auth:** JWT stored in the device keychain (expo-secure-store)

## Structure

```
mobile/
  app/                 screens (Expo Router)
    landing.tsx        pre-auth landing
    (auth)/            login, signup, forgot-password
    (tabs)/            discover, likes, matches, messages, settings
    call/[callId].tsx  call screen (calling phase)
  src/
    theme.ts           navy/gold design tokens (ported from web)
    api.ts             backend client + React Query
    auth.tsx           auth context
    components/        shared UI (Button, Input, Card, Screen)
  assets/              icon, splash, geometric pattern
```

## First-time setup (on the Mac)

```bash
cd mobile
npm install
npm install -g eas-cli   # once
eas login                # your Apple/Expo account
```

## Run in development

```bash
# Cloud dev build (installs on device, no Xcode archive dance):
eas build --profile development --platform ios
# then:
npx expo start --dev-client
```

## Ship to TestFlight

```bash
eas build --profile production --platform ios
eas submit --profile production --platform ios
```

Fill in `submit.production.ios.ascAppId` in `eas.json` with the App Store Connect
app ID (App Store Connect → App → App Information → "Apple ID").

## Environment

`app.json` → `extra.apiUrl` sets the backend URL. Override per-build with
`EXPO_PUBLIC_API_URL` if pointing at a staging server.

## Build status

- [x] Foundation: theme, API client, JWT auth, navigation
- [x] Auth: landing, login, signup, forgot-password
- [ ] Onboarding + profile setup + verification
- [ ] Discover / likes / matches
- [ ] Chat (Sendbird RN UIKit)
- [ ] Calling (Agora RN + CallKeep/VoIP)
- [ ] Subscription (Apple IAP)
- [ ] Settings / safety / EAS pipeline
