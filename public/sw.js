// Service Worker for Push Notifications
const CACHE_NAME = 'fusion-v1';

// Listen for push events
self.addEventListener('push', event => {
  console.log('[Service Worker] Push Received:', event);
  
  let data;
  
  if (event.data) {
    data = event.data.json();
  }
  
  const title = data.title || 'Fusion';
  const options = {
    body: data.body || 'New notification',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-72.png',
    image: data.image,
    data: {
      url: data.url || '/',
      callId: data.callId,
      matchId: data.matchId,
      userId: data.userId
    },
    actions: data.actions || [
      { action: 'view', title: 'View' },
      { action: 'close', title: 'Dismiss' }
    ],
    requireInteraction: data.requireInteraction || false,
    tag: data.tag || 'notification',
    renotify: true,
    vibrate: [200, 100, 200],
    silent: false
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click:', event.action);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  const urlToOpen = event.notification.data.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Check if a window is already open
        for (let client of clientList) {
          if (client.url.includes(window.location.origin) && 'focus' in client) {
            return client.focus().then(client => {
              // Navigate to the URL if needed
              if (client.url !== urlToOpen) {
                return client.navigate(urlToOpen);
              }
              return client;
            });
          }
        }
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', event => {
  console.log('[Service Worker] Push subscription changed');
  
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then(subscription => {
        return fetch('/api/push/update-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription)
        });
      })
  );
});

// Install service worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

// Activate service worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(clients.claim());
});
