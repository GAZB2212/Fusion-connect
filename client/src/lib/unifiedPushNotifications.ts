// Unified Push Notification Service
// Works with both Web Push (browsers) and Native Push (Capacitor iOS/Android)

import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { isCapacitorNative, getPlatform, getPlatformInfo } from './platform';
import { getApiUrl, getAuthToken } from './queryClient';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface PushToken {
  type: 'web' | 'fcm' | 'apns';
  token: string;
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

// Store the current device token for reference
let currentDeviceToken: string | null = null;

// Track if native listeners are already set up (to avoid duplicates)
let nativeListenersInitialized = false;

// Promise resolver for registration token
let registrationResolver: ((token: PushToken | null) => void) | null = null;

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
  if (!isCapacitorNative()) return 'unknown';
  
  try {
    const result = await PushNotifications.checkPermissions();
    if (result.receive === 'granted') return 'granted';
    if (result.receive === 'denied') return 'denied';
    return 'prompt';
  } catch (error) {
    console.error('Native permission check failed:', error);
    return 'unknown';
  }
}

async function nativeRequestPermission(): Promise<NotificationPermissionStatus> {
  if (!isCapacitorNative()) return 'denied';
  
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

// Set up registration listeners ONCE (must be called before register())
async function setupRegistrationListeners(): Promise<void> {
  if (nativeListenersInitialized) {
    console.log('[Push] Registration listeners already initialized');
    return;
  }
  
  console.log('[Push] Setting up registration listeners BEFORE calling register()');
  
  // Listen for registration success - this fires AFTER register() is called
  await PushNotifications.addListener('registration', (token: Token) => {
    const platform = getPlatform();
    currentDeviceToken = token.value;
    
    // Log the full token for debugging (truncate for security)
    const tokenPreview = token.value.length > 40 
      ? token.value.substring(0, 20) + '...' + token.value.substring(token.value.length - 10)
      : token.value;
    console.log(`[Push] SUCCESS - Received ${platform} device token: ${tokenPreview}`);
    console.log(`[Push] Token length: ${token.value.length} characters`);
    
    // Resolve any pending registration promise
    if (registrationResolver) {
      registrationResolver({
        type: platform === 'ios' ? 'apns' : 'fcm',
        token: token.value
      });
      registrationResolver = null;
    }
  });
  
  // Listen for registration error
  await PushNotifications.addListener('registrationError', (error: any) => {
    console.error('[Push] REGISTRATION ERROR:', JSON.stringify(error, null, 2));
    console.error('[Push] Error message:', error?.message || error?.error || 'Unknown error');
    
    // Resolve any pending registration promise with null
    if (registrationResolver) {
      registrationResolver(null);
      registrationResolver = null;
    }
  });
  
  nativeListenersInitialized = true;
  console.log('[Push] Registration listeners set up successfully');
}

async function nativeRegister(): Promise<PushToken | null> {
  if (!isCapacitorNative()) {
    console.log('[Push] Not running in Capacitor native environment');
    return null;
  }
  
  console.log('[Push] Starting native push registration...');
  
  // CRITICAL: Set up listeners BEFORE calling register()
  await setupRegistrationListeners();
  
  return new Promise((resolve) => {
    // Store resolver for the registration listener to call
    registrationResolver = resolve;
    
    console.log('[Push] Calling PushNotifications.register()...');
    
    // Now call register - the token will be delivered to the 'registration' listener
    PushNotifications.register()
      .then(() => {
        console.log('[Push] register() call completed, waiting for token via registration event...');
      })
      .catch((error) => {
        console.error('[Push] register() call failed:', error);
        registrationResolver = null;
        resolve(null);
      });
    
    // Timeout after 15 seconds (increased from 10)
    setTimeout(() => {
      if (registrationResolver === resolve) {
        console.warn('[Push] Registration timed out after 15 seconds - no token received');
        console.warn('[Push] This may indicate APNs/FCM is not properly configured');
        registrationResolver = null;
        resolve(null);
      }
    }, 15000);
  });
}

async function nativeUnsubscribe(): Promise<boolean> {
  currentDeviceToken = null;
  return true;
}

// Navigation callback for handling notification taps
let navigationCallback: ((matchId: string) => void) | null = null;

export function setNavigationCallback(callback: (matchId: string) => void): void {
  navigationCallback = callback;
}

// Track if notification listeners are set up
let notificationListenersInitialized = false;

// Set up native notification listeners
export async function setupNativeNotificationListeners(
  onNotificationReceived?: (notification: NotificationData) => void,
  onNotificationTapped?: (notification: NotificationData) => void
): Promise<void> {
  if (!isCapacitorNative()) {
    console.log('[Push] Not native platform, skipping notification listeners');
    return;
  }
  
  if (notificationListenersInitialized) {
    console.log('[Push] Notification listeners already initialized');
    return;
  }
  
  console.log('[Push] Setting up native notification listeners...');
  
  // CRITICAL: Set up registration listeners FIRST before any register() calls
  await setupRegistrationListeners();
  
  // Notification received while app is in foreground
  await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('[Push] Notification received in foreground:', JSON.stringify(notification, null, 2));
    
    // Parse Sendbird push data
    let sendbirdData = null;
    try {
      sendbirdData = notification.data?.sendbird ? JSON.parse(notification.data.sendbird) : null;
    } catch (e) {
      console.log('[Push] Could not parse Sendbird data');
    }
    const channelUrl = sendbirdData?.channel?.channel_url || notification.data?.channelUrl || notification.data?.matchId;
    
    onNotificationReceived?.({
      title: notification.title || '',
      body: notification.body || '',
      data: {
        ...notification.data,
        matchId: channelUrl,
        channelUrl
      }
    });
  });
  
  // Notification tapped (app was in background or closed)
  await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    console.log('[Push] Notification tapped:', JSON.stringify(action, null, 2));
    
    // Parse Sendbird push data
    const notificationData = action.notification?.data;
    let sendbirdData = null;
    try {
      sendbirdData = notificationData?.sendbird ? JSON.parse(notificationData.sendbird) : null;
    } catch (e) {
      console.log('[Push] Could not parse Sendbird data');
    }
    const channelUrl = sendbirdData?.channel?.channel_url || notificationData?.channelUrl || notificationData?.matchId;
    
    const parsedNotification: NotificationData = {
      title: action.notification?.title || '',
      body: action.notification?.body || '',
      data: {
        ...notificationData,
        matchId: channelUrl,
        channelUrl
      }
    };
    
    onNotificationTapped?.(parsedNotification);
    
    // Navigate to the chat if we have a channel URL
    if (channelUrl && navigationCallback) {
      console.log('[Push] Navigating to chat:', channelUrl);
      navigationCallback(channelUrl);
    } else if (channelUrl) {
      // Fallback to direct location change
      console.log('[Push] Using fallback navigation to:', channelUrl);
      window.location.href = `/messages/${channelUrl}`;
    }
  });
  
  notificationListenersInitialized = true;
  console.log('[Push] All notification listeners set up successfully');
}

// ============================================
// Unified API
// ============================================

export async function isPushSupported(): Promise<boolean> {
  if (isCapacitorNative()) {
    return true; // Capacitor always supports push on iOS/Android
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
    return nativeRegister();
  } else {
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

// Save push token to server (also registers with Sendbird for native tokens)
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
      console.log('[Push] Token saved to server and registered with Sendbird');
      return true;
    } else {
      console.error('[Push] Failed to save push token:', await response.text());
      return false;
    }
  } catch (error) {
    console.error('[Push] Error saving push token:', error);
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
      credentials: 'include',
      body: JSON.stringify({
        token: currentDeviceToken
      })
    });
    
    if (response.ok) {
      console.log('[Push] Token removed from server');
      return true;
    } else {
      console.error('[Push] Failed to remove push token:', await response.text());
      return false;
    }
  } catch (error) {
    console.error('[Push] Error removing push token:', error);
    return false;
  }
}

// Get unread message count for badge
export async function getUnreadMessageCount(): Promise<number> {
  try {
    const authToken = getAuthToken();
    const response = await fetch(getApiUrl('/api/push/unread-count'), {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      },
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.unreadCount || 0;
    }
    return 0;
  } catch (error) {
    console.error('[Push] Error getting unread count:', error);
    return 0;
  }
}

// Update app badge count (iOS only)
export async function updateBadgeCount(count: number): Promise<void> {
  if (!isCapacitorNative()) return;
  
  try {
    // On iOS, the badge is typically updated via the push notification payload
    // However, we can also set it locally using Capacitor Badge plugin if available
    const Badge = (window as any).Capacitor?.Plugins?.Badge;
    if (Badge) {
      if (count > 0) {
        await Badge.set({ count });
      } else {
        await Badge.clear();
      }
      console.log('[Push] Badge count updated to:', count);
    }
  } catch (error) {
    console.error('[Push] Error updating badge:', error);
  }
}

// Initialize push notifications (call on app load after user is authenticated)
export async function initializePushNotifications(
  vapidPublicKey?: string,
  onNavigateToChat?: (matchId: string) => void
): Promise<void> {
  const supported = await isPushSupported();
  if (!supported) {
    console.log('[Push] Push notifications not supported on this platform');
    return;
  }
  
  const platformInfo = getPlatformInfo();
  console.log(`[Push] Initializing push notifications for ${platformInfo.platform}`);
  console.log(`[Push] Platform info:`, JSON.stringify(platformInfo, null, 2));
  
  // Set navigation callback
  if (onNavigateToChat) {
    setNavigationCallback(onNavigateToChat);
  }
  
  // CRITICAL: Set up native listeners FIRST if on Capacitor (before any registration)
  if (platformInfo.isNative) {
    console.log('[Push] Setting up native listeners BEFORE registration...');
    await setupNativeNotificationListeners(
      (notification) => {
        console.log('[Push] Foreground notification received:', notification);
        // Could show an in-app notification banner here
      },
      (notification) => {
        console.log('[Push] Notification tapped, data:', notification.data);
        // Navigation is handled in the listener
      }
    );
    console.log('[Push] Native listeners setup complete');
  }
  
  // Check if permission already granted
  const permission = await getNotificationPermission();
  console.log('[Push] Current permission status:', permission);
  
  if (permission === 'granted') {
    console.log('[Push] Permission already granted, registering for push...');
    const token = await registerForPushNotifications(vapidPublicKey);
    if (token) {
      console.log('[Push] Token received, saving to server...');
      await savePushTokenToServer(token);
      
      // Update badge count after registration
      const unreadCount = await getUnreadMessageCount();
      await updateBadgeCount(unreadCount);
    } else {
      console.warn('[Push] No token received from registration');
    }
  } else if (permission === 'prompt') {
    console.log('[Push] Permission not yet granted, user needs to enable notifications');
  } else {
    console.log('[Push] Permission denied, cannot register for push');
  }
}

// Enable push notifications (call when user wants to enable)
export async function enablePushNotifications(vapidPublicKey?: string): Promise<boolean> {
  const supported = await isPushSupported();
  if (!supported) {
    console.log('[Push] Push not supported');
    return false;
  }
  
  console.log('[Push] Enabling push notifications...');
  
  // Set up listeners first if native (CRITICAL for Capacitor)
  const platformInfo = getPlatformInfo();
  if (platformInfo.isNative) {
    console.log('[Push] Setting up native listeners before requesting permission...');
    await setupNativeNotificationListeners();
  }
  
  const permission = await requestNotificationPermission();
  console.log('[Push] Permission result:', permission);
  
  if (permission !== 'granted') {
    console.log('[Push] Notification permission denied');
    return false;
  }
  
  console.log('[Push] Permission granted, registering...');
  const token = await registerForPushNotifications(vapidPublicKey);
  
  if (!token) {
    console.warn('[Push] Failed to get push token');
    return false;
  }
  
  console.log('[Push] Got token, saving to server...');
  return savePushTokenToServer(token);
}

// Disable push notifications
export async function disablePushNotifications(): Promise<boolean> {
  await removePushTokenFromServer();
  const unregistered = await unregisterFromPushNotifications();
  await updateBadgeCount(0);
  return unregistered;
}

// Re-register push token (call after login or when token might be stale)
export async function refreshPushToken(vapidPublicKey?: string): Promise<boolean> {
  const supported = await isPushSupported();
  if (!supported) return false;
  
  console.log('[Push] Refreshing push token...');
  
  // Ensure listeners are set up first if native
  const platformInfo = getPlatformInfo();
  if (platformInfo.isNative) {
    await setupNativeNotificationListeners();
  }
  
  const permission = await getNotificationPermission();
  if (permission !== 'granted') {
    console.log('[Push] Permission not granted, cannot refresh token');
    return false;
  }
  
  const token = await registerForPushNotifications(vapidPublicKey);
  if (!token) {
    console.warn('[Push] Failed to get token during refresh');
    return false;
  }
  
  console.log('[Push] Token refreshed, saving to server...');
  return savePushTokenToServer(token);
}
