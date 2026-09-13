// Minimal push-only service worker — no offline caching, just Web Push.
// Registered at the root scope (/) from PushNotificationService so it can
// receive a push for any route in the app.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Nirvaana House', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Nirvaana House';
  const options = {
    body: data.body || '',
    tag: data.tag || 'general',
    // Same tag replaces the previous notification instead of stacking —
    // matters for chat, where several messages can arrive in a burst.
    renotify: true,
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
