// Simplified Push Notification initialization
// Based on recommended Capacitor pattern for iOS/Android
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';

let listenersSet = false;

// Storage keys
const APNS_TOKEN_KEY = 'apnsToken';
const FCM_TOKEN_KEY = 'fcmToken';

export function getStoredPushToken(): string | null {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') {
    return localStorage.getItem(APNS_TOKEN_KEY);
  } else if (platform === 'android') {
    return localStorage.getItem(FCM_TOKEN_KEY);
  }
  return null;
}

export function getPushTokenType(): 'apns' | 'fcm' | null {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return 'apns';
  if (platform === 'android') return 'fcm';
  return null;
}

export async function initPush() {
  // Only run on real native builds (iOS/Android), not in a normal browser
  if (!Capacitor.isNativePlatform()) {
    console.log('[Push] Not native platform, skipping push init');
    return;
  }

  const platform = Capacitor.getPlatform();
  console.log('[Push] initPush() starting on platform:', platform);

  if (!listenersSet) {
    listenersSet = true;
    console.log('[Push] Setting up listeners for first time...');

    PushNotifications.addListener('registration', (token: Token) => {
      console.log('[Push] =============================================');
      console.log('[Push] JS registration SUCCESS!');
      console.log('[Push] Token value:', token.value);
      console.log('[Push] Token length:', token.value.length);
      console.log('[Push] =============================================');
      
      // Store in localStorage based on platform
      if (platform === 'ios') {
        localStorage.setItem(APNS_TOKEN_KEY, token.value);
        console.log('[Push] APNs token saved to localStorage');
      } else if (platform === 'android') {
        localStorage.setItem(FCM_TOKEN_KEY, token.value);
        console.log('[Push] FCM token saved to localStorage');
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] =============================================');
      console.error('[Push] JS registrationError!');
      console.error('[Push] Error:', JSON.stringify(err));
      console.error('[Push] =============================================');
    });

    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('[Push] Notification received:', JSON.stringify(notification));
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('[Push] Notification action performed:', JSON.stringify(action));
    });

    console.log('[Push] All listeners set up successfully');
  } else {
    console.log('[Push] Listeners already set, skipping setup');
  }

  // Check permissions
  const perm = await PushNotifications.checkPermissions();
  console.log('[Push] Permission status:', JSON.stringify(perm));

  if (perm.receive !== 'granted') {
    console.log('[Push] Requesting permission...');
    const req = await PushNotifications.requestPermissions();
    console.log('[Push] Permission request result:', JSON.stringify(req));
    if (req.receive !== 'granted') {
      console.log('[Push] Permission denied, cannot proceed');
      return;
    }
  }

  console.log('[Push] Permission granted, calling register()...');
  console.log('[Push] NOTE: On iOS, if no token appears:');
  console.log('[Push]   1. Check Push Notifications capability in Xcode');
  console.log('[Push]   2. Check Background Modes > Remote notifications');
  console.log('[Push]   3. Check App.entitlements has aps-environment');
  console.log('[Push]   4. Check APNs key is uploaded to Sendbird Dashboard');
  console.log('[Push]   5. Must test on real device, not simulator');
  
  try {
    await PushNotifications.register();
    console.log('[Push] register() call completed');
    console.log('[Push] Waiting for registration event...');
  } catch (error) {
    console.error('[Push] register() threw error:', error);
  }
}
