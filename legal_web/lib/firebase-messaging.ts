/**
 * Firebase Cloud Messaging helpers for web push notifications.
 * Uses the modular Firebase SDK (v9+).
 *
 * Call `initWebPush()` once the user is authenticated. It:
 *  1. Registers the service worker
 *  2. Posts the Firebase config to the SW so it can self-initialise
 *  3. Requests notification permission
 *  4. Retrieves the FCM registration token
 *
 * Returns the FCM token (string) if successful, or null when push is not
 * supported / the user denied permission / Firebase is not configured.
 */

import { getFirebaseApp, isFirebaseConfigured } from './firebase'

let _token: string | null = null

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'Notification' in window &&
    isFirebaseConfigured() &&
    Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY)
  )
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    })

    // Post the Firebase config to the service worker so it can initialise FCM.
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    }

    const worker = reg.installing ?? reg.waiting ?? reg.active
    worker?.postMessage({ type: 'FIREBASE_CONFIG', config })

    return reg
  } catch {
    return null
  }
}

/**
 * Request permission and return the FCM registration token, or null.
 */
export async function initWebPush(): Promise<string | null> {
  if (!isWebPushSupported()) return null
  if (_token) return _token

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  try {
    const sw = await registerServiceWorker()
    if (!sw) return null

    // Lazy-import the messaging module only when we know it's needed.
    const { getMessaging, getToken } = await import('firebase/messaging')
    const app = getFirebaseApp()
    const messaging = getMessaging(app)

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: sw,
    })

    _token = token || null
    return _token
  } catch {
    return null
  }
}

/** Discard the cached token (call on logout). */
export function clearWebPushToken() {
  _token = null
}
