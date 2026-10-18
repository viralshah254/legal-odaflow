// Firebase Cloud Messaging service worker for background push notifications.
// This file must live at the root of the web app's public path so the browser
// can register it at /firebase-messaging-sw.js.

importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-messaging-compat.js');

// Config is injected at registration time via MessageChannel so we don't have
// to hard-code credentials here.  Until the config arrives we cache it.
let _config = null;

const DEFAULT_NOTIFICATION_LINK = '/app/alerts';
const SAFE_RELATIVE_PATH = /^\/[a-zA-Z0-9/_-]+$/;

function sanitizeNotificationLink(link) {
  if (typeof link !== 'string') return DEFAULT_NOTIFICATION_LINK;

  const trimmed = link.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes(':')) {
    return DEFAULT_NOTIFICATION_LINK;
  }

  return SAFE_RELATIVE_PATH.test(trimmed) ? trimmed : DEFAULT_NOTIFICATION_LINK;
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG' && !_config) {
    _config = event.data.config;
    initFirebase();
  }
});

function initFirebase() {
  if (!_config || firebase.apps.length) return;
  firebase.initializeApp(_config);

  const messaging = firebase.messaging();

  // Background message handler — shows a system notification when the tab is
  // not in focus.  FCM also sends its own notification for data-only payloads
  // when the app is terminated; this handler covers the background case.
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? 'Umbrella';
    const body = payload.notification?.body ?? 'You have a new update';
    const icon = '/icon-192.png';
    const link = sanitizeNotificationLink(
      payload.data?.route ?? payload.data?.link ?? DEFAULT_NOTIFICATION_LINK,
    );

    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/badge-72.png',
      data: { link },
      vibrate: [200, 100, 200],
    });
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = sanitizeNotificationLink(event.notification.data?.link);
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing tab if one is open.
        for (const client of windowClients) {
          if ('focus' in client) {
            client.focus();
            client.navigate(link);
            return;
          }
        }
        // Otherwise open a new tab.
        if (clients.openWindow) {
          return clients.openWindow(link);
        }
      }),
  );
});
