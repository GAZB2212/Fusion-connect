// Unified Push Notification Service
// Works with both Web Push (browsers) and Native Push (Capacitor iOS/Android)

import { isCapacitorNative, getPlatform, getPlatformInfo } from './platform';
import { getApiUrl, getAuthToken } from './queryClient';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface PushToken {
  type: 'web' | 'fcm' | 'apns';
  token: string;
  // For web push, these additional fields are needed
  endpoint?: string;
  auth?: string;
  p256dh?: string;
}

export interface NotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
}

// ============================================
// Web Push Implementation (for browsers)
// ============================================

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function webPushSupported(): Promise<boolean> {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function webGetPermission(): Promise<NotificationPermissionStatus> {
  if (!await webPushSupported()) return 'denied';
  const perm = Notification.permission;
  if (perm === 'default') return 'prompt';
  return perm as NotificationPermissionStatus;
}

async function webRequestPermission(): Promise<NotificationPermissionStatus> {
  if (!await webPushSupported()) return 'denied';
  const permission = await Notification.requestPermission();
  if (permission === 'default') return 'prompt';
  return permission as NotificationPermissionStatus;
}

async function webRegisterServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

async function webSubscribe(vapidPublicKey: string): Promise<PushToken | null> {
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
    }
    
    const json = subscription.toJSON();
    return {
      type: 'web',
      token: json.endpoint || '',
      endpoint: json.endpoint,
      auth: json.keys?.auth,
      p256dh: json.keys?.p256dh
    };
  } catch (error) {
    console.error('Web push subscription failed:', error);
    return null;
  }
}

async function webUnsubscribe(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Web push unsubscribe failed:', error);
    return false;
  }
}

// ============================================
// Native Push Implementation (for Capacitor)
// ============================================

async function nativeGetPermission(): Promise<NotificationPermissionStatus> {
  const PushNotifications = (window as any).Capacitor?.Plugins?.PushNotifications;
  if (!PushNotifications) return 'unknown';
  
  try {
    const result = await PushNotifications.checkPermissions();
    // Capacitor returns: 'prompt', 'prompt-with-rationale', 'granted', 'denied'
    if (result.receive === 'granted') return 'granted';
    if (result.receive === 'denied') return 'denied';
    return 'prompt';
  } catch (error) {
    console.error('Native permission check failed:', error);
    return 'unknown';
  }
}

async function nativeRequestPermission(): Promise<NotificationPermissionStatus> {
  const PushNotifications = (window as any).Capacitor?.Plugins?.PushNotifications;
  if (!PushNotifications) return 'denied';
  
  try {
    const result = await PushNotifications.requestPermissions();
    if (result.receive === 'granted') return 'granted';
    if (result.receive === 'denied') return 'denied';
    return 'prompt';
  } catch (error) {
    console.error('Native permission request failed:', error);
    return 'denied';
  }
}

async function nativeRegister(): Promise<PushToken | null> {
  const PushNotifications = (window as any).Capacitor?.Plugins?.PushNotifications;
  if (!PushNotifications) return null;
  
  return new Promise((resolve) => {
    // Listen for registration success
    PushNotifications.addListener('registration', (token: { value: string }) => {
      const platform = getPlatform();
      resolve({
        type: platform === 'ios' ? 'apns' : 'fcm',
        token: token.value
      });
    });
    
    // Listen for registration error
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Native push registration error:', error);
      resolve(null);
    });
    
    // Register for push notifications
    PushNotifications.register();
    
    // Timeout after 10 seconds
    setTimeout(() => resolve(null), 10000);
  });
}

async function nativeUnsubscribe(): Promise<boolean> {
  // Native apps don't really "unsubscribe" - they just stop sending the token to server
  // The token remains valid until the app is uninstalled
  return true;
}

// Set up native notification listeners
export function setupNativeNotificationListeners(
  onNotificationReceived?: (notification: NotificationData) => void,
  onNotificationTapped?: (notification: NotificationData) => void
): void {
  if (!isCapacitorNative()) return;
  
  const PushNotifications = (window as any).Capacitor?.Plugins?.PushNotifications;
  if (!PushNotifications) return;
  
  // Notification received while app is in foreground
  PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
    console.log('Push notification received:', notification);
    onNotificationReceived?.({
      title: notification.title || '',
      body: notification.body || '',
      data: notification.data
    });
  });
  
  // Notification tapped (app was in background or closed)
  PushNotifications.addListener('pushNotificationActionPerformed', (action: any) => {
    console.log('Push notification tapped:', action);
    onNotificationTapped?.({
      title: action.notification?.title || '',
      body: action.notification?.body || '',
      data: action.notification?.data
    });
  });
}

// ============================================
// Unified API
// ============================================

export async function isPushSupported(): Promise<boolean> {
  if (isCapacitorNative()) {
    return !!(window as any).Capacitor?.Plugins?.PushNotifications;
  }
  return webPushSupported();
}

export async function getNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (isCapacitorNative()) {
    return nativeGetPermission();
  }
  return webGetPermission();
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (isCapacitorNative()) {
    return nativeRequestPermission();
  }
  return webRequestPermission();
}

export async function registerForPushNotifications(vapidPublicKey?: string): Promise<PushToken | null> {
  const platformInfo = getPlatformInfo();
  
  if (platformInfo.isNative) {
    // Native Capacitor app
    return nativeRegister();
  } else {
    // Web browser
    if (!vapidPublicKey) {
      console.error('VAPID public key required for web push');
      return null;
    }
    await webRegisterServiceWorker();
    return webSubscribe(vapidPublicKey);
  }
}

export async function unregisterFromPushNotifications(): Promise<boolean> {
  if (isCapacitorNative()) {
    return nativeUnsubscribe();
  }
  return webUnsubscribe();
}

// Save push token to server
export async function savePushTokenToServer(token: PushToken): Promise<boolean> {
  try {
    const authToken = getAuthToken();
    const response = await fetch(getApiUrl('/api/push/register'), {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({
        type: token.type,
        token: token.token,
        endpoint: token.endpoint,
        auth: token.auth,
        p256dh: token.p256dh
      })
    });
    
    if (response.ok) {
      console.log('Push token saved to server');
      return true;
    } else {
      console.error('Failed to save push token:', await response.text());
      return false;
    }
  } catch (error) {
    console.error('Error saving push token:', error);
    return false;
  }
}

// Remove push token from server
export async function removePushTokenFromServer(): Promise<boolean> {
  try {
    const authToken = getAuthToken();
    const response = await fetch(getApiUrl('/api/push/unregister'), {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      },
      credentials: 'include'
    });
    
    if (response.ok) {
      console.log('Push token removed from server');
      return true;
    } else {
      console.error('Failed to remove push token:', await response.text());
      return false;
    }
  } catch (error) {
    console.error('Error removing push token:', error);
    return false;
  }
}

// Initialize push notifications (call on app load)
export async function initializePushNotifications(vapidPublicKey?: string): Promise<void> {
  const supported = await isPushSupported();
  if (!supported) {
    console.log('Push notifications not supported on this platform');
    return;
  }
  
  const platformInfo = getPlatformInfo();
  console.log(`Initializing push notifications for ${platformInfo.platform}`);
  
  // Set up native listeners if on Capacitor
  if (platformInfo.isNative) {
    setupNativeNotificationListeners(
      (notification) => {
        // Handle foreground notification
        console.log('Foreground notification:', notification);
      },
      (notification) => {
        // Handle notification tap - navigate to relevant screen
        console.log('Notification tapped:', notification);
        if (notification.data?.matchId) {
          window.location.href = `/messages/${notification.data.matchId}`;
        }
      }
    );
  }
  
  // Check if permission already granted
  const permission = await getNotificationPermission();
  if (permission === 'granted') {
    const token = await registerForPushNotifications(vapidPublicKey);
    if (token) {
      await savePushTokenToServer(token);
    }
  }
}

// Enable push notifications (call when user wants to enable)
export async function enablePushNotifications(vapidPublicKey?: string): Promise<boolean> {
  const supported = await isPushSupported();
  if (!supported) return false;
  
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    console.log('Notification permission denied');
    return false;
  }
  
  const token = await registerForPushNotifications(vapidPublicKey);
  if (!token) return false;
  
  return savePushTokenToServer(token);
}

// Disable push notifications
export async function disablePushNotifications(): Promise<boolean> {
  const unregistered = await unregisterFromPushNotifications();
  if (unregistered) {
    await removePushTokenFromServer();
    return true;
  }
  return false;
}
