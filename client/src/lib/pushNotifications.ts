// Push Notifications Utility
import { getApiUrl } from './queryClient';

// Convert VAPID key for subscription
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

// Check if push notifications are supported
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Get current notification permission status
export function getNotificationPermission(): NotificationPermission {
  if (!isPushSupported()) {
    return 'denied';
  }
  return Notification.permission;
}

// Register service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('Service Worker registered:', registration);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    console.log('Push notifications not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  console.log('Notification permission:', permission);
  return permission;
}

// Subscribe to push notifications
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Subscribe to push
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
      console.log('Push subscription created:', subscription);
    } else {
      console.log('Already subscribed to push:', subscription);
    }
    
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push:', error);
    return null;
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      console.log('Unsubscribed from push');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Failed to unsubscribe from push:', error);
    return false;
  }
}

// Get current push subscription
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('Failed to get subscription:', error);
    return null;
  }
}

// Save subscription to server
export async function saveSubscriptionToServer(subscription: PushSubscription): Promise<boolean> {
  try {
    const subscriptionJson = subscription.toJSON();
    
    const response = await fetch(getApiUrl('/api/push/subscribe'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        endpoint: subscriptionJson.endpoint,
        auth: subscriptionJson.keys?.auth,
        p256dh: subscriptionJson.keys?.p256dh
      })
    });
    
    if (response.ok) {
      console.log('Subscription saved to server');
      return true;
    } else {
      console.error('Failed to save subscription:', await response.text());
      return false;
    }
  } catch (error) {
    console.error('Error saving subscription:', error);
    return false;
  }
}

// Remove subscription from server
export async function removeSubscriptionFromServer(): Promise<boolean> {
  try {
    const response = await fetch(getApiUrl('/api/push/unsubscribe'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    
    if (response.ok) {
      console.log('Subscription removed from server');
      return true;
    } else {
      console.error('Failed to remove subscription:', await response.text());
      return false;
    }
  } catch (error) {
    console.error('Error removing subscription:', error);
    return false;
  }
}

// Initialize push notifications (call this on app load)
export async function initializePushNotifications(vapidPublicKey: string): Promise<void> {
  if (!isPushSupported()) {
    console.log('Push notifications not supported on this browser');
    return;
  }

  // Register service worker
  const registration = await registerServiceWorker();
  if (!registration) {
    console.log('Failed to register service worker');
    return;
  }

  // If permission already granted, subscribe
  if (Notification.permission === 'granted') {
    const subscription = await subscribeToPush(vapidPublicKey);
    if (subscription) {
      await saveSubscriptionToServer(subscription);
    }
  }
}

// Request permission and subscribe (call this when user wants to enable notifications)
export async function enablePushNotifications(vapidPublicKey: string): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }

  // Request permission
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    console.log('Notification permission denied');
    return false;
  }

  // Subscribe to push
  const subscription = await subscribeToPush(vapidPublicKey);
  if (!subscription) {
    return false;
  }

  // Save to server
  return await saveSubscriptionToServer(subscription);
}

// Disable push notifications
export async function disablePushNotifications(): Promise<boolean> {
  const unsubscribed = await unsubscribeFromPush();
  if (unsubscribed) {
    await removeSubscriptionFromServer();
    return true;
  }
  return false;
}
