export function buildFirebaseInitJson(authDomain: string): Record<string, string> {
  const config: Record<string, string> = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  }

  const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim()
  if (measurementId) {
    config.measurementId = measurementId
  }

  return config
}

export function resolveFirebaseInitAuthDomain(host: string): string | null {
  const trimmed = host.trim().toLowerCase()
  if (!trimmed) return null

  if (/^localhost(:\d+)?$/i.test(trimmed) || /^127\.0\.0\.1(:\d+)?$/.test(trimmed)) {
    return trimmed
  }

  const configured = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim()
  const normalizedConfigured = configured?.replace(/^https?:\/\//, "").toLowerCase()

  if (normalizedConfigured && trimmed === normalizedConfigured) {
    return configured!.replace(/^https?:\/\//, "")
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  let appHost: string | null = null
  if (appUrl) {
    try {
      appHost = new URL(appUrl).host.toLowerCase()
      if (trimmed === appHost) {
        return appHost
      }
    } catch {
      // ignore invalid APP_URL
    }
  }

  // Apex marketing domain — serve Firebase init with canonical auth domain.
  if (
    (trimmed === "okaylegal.ai" || trimmed === "www.okaylegal.ai") &&
    (normalizedConfigured || appHost)
  ) {
    return normalizedConfigured ?? appHost
  }

  return null
}
