/**
 * Build Content-Security-Policy and related security headers for Next.js.
 * CommonJS module — required by next.config.js at build time.
 */

const STATIC_CONNECT_HOSTS = [
  "https://*.googleapis.com",
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
  "https://www.googleapis.com",
  "https://firebaseinstallations.googleapis.com",
  "https://fcmregistrations.googleapis.com",
  "https://apis.google.com",
  "https://accounts.google.com",
  "https://appleid.apple.com",
  "https://api.stripe.com",
  "https://m.stripe.network",
  "https://vitals.vercel-insights.com",
  "https://va.vercel-scripts.com",
  "https://challenges.cloudflare.com",
]

const STATIC_SCRIPT_HOSTS = [
  "https://js.stripe.com",
  "https://www.gstatic.com",
  "https://www.google.com",
  "https://apis.google.com",
  "https://accounts.google.com",
  "https://appleid.apple.com",
  "https://va.vercel-scripts.com",
  "https://challenges.cloudflare.com",
]

const STATIC_FRAME_HOSTS = [
  "https://js.stripe.com",
  "https://hooks.stripe.com",
  "https://www.google.com",
  "https://www.gstatic.com",
  "https://challenges.cloudflare.com",
]

const STATIC_STYLE_HOSTS = ["https://fonts.googleapis.com"]

const STATIC_FONT_HOSTS = ["https://fonts.gstatic.com"]

/**
 * @param {string | undefined} value
 * @returns {string | undefined}
 */
function parseOrigin(value) {
  if (!value?.trim()) return undefined
  try {
    return new URL(value.trim()).origin
  } catch {
    return undefined
  }
}

/**
 * HTTP(S) origins plus matching ws(s) for WebSocket clients (Socket.IO).
 * @param {string | undefined} value
 * @returns {string[]}
 */
function parseConnectOrigins(value) {
  if (!value?.trim()) return []
  try {
    const url = new URL(value.trim())
    const origins = [url.origin]
    if (url.protocol === "https:") origins.push(`wss://${url.host}`)
    else if (url.protocol === "http:") origins.push(`ws://${url.host}`)
    else if (url.protocol === "wss:" || url.protocol === "ws:") origins.push(url.origin)
    return origins
  } catch {
    return []
  }
}

/**
 * @param {string | undefined} dsn
 * @returns {string | undefined}
 */
function parseSentryIngestOrigin(dsn) {
  if (!dsn?.trim()) return undefined
  try {
    const url = new URL(dsn.trim())
    return `${url.protocol}//${url.host}`
  } catch {
    return undefined
  }
}

/**
 * @param {string | undefined} bucket
 * @returns {string | undefined}
 */
function parseFirebaseStorageOrigin(bucket) {
  if (!bucket?.trim()) return undefined
  return `https://${bucket.trim()}`
}

/**
 * @param {string | undefined} authDomain
 * @returns {string | undefined}
 */
function parseFirebaseAuthOrigin(authDomain) {
  if (!authDomain?.trim()) return undefined
  return `https://${authDomain.trim()}`
}

/**
 * @param {string[]} values
 * @returns {string[]}
 */
function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

/**
 * @param {Record<string, string[]>} directives
 * @returns {string}
 */
function formatDirectives(directives) {
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ")
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @param {{ mode?: 'report-only' | 'enforce'; reportUri?: string; skip?: boolean }} [options]
 * @returns {string | null}
 */
function buildContentSecurityPolicy(env = process.env, options = {}) {
  if (options.skip || env.ELECTRON === "true") {
    return null
  }
  if (env.NODE_ENV !== "production") return null
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "production") return null

  const connectSrc = unique([
    "'self'",
    ...parseConnectOrigins(env.NEXT_PUBLIC_APP_URL),
    ...parseConnectOrigins(env.NEXT_PUBLIC_WS_URL),
    ...parseConnectOrigins(env.NEXT_PUBLIC_API_URL),
    parseOrigin(env.NEXT_PUBLIC_POSTHOG_HOST),
    parseSentryIngestOrigin(env.NEXT_PUBLIC_SENTRY_DSN),
    parseFirebaseAuthOrigin(env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    parseFirebaseStorageOrigin(env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    ...STATIC_CONNECT_HOSTS,
  ])

  const scriptSrc = unique([
    "'self'",
    "'unsafe-inline'",
    ...STATIC_SCRIPT_HOSTS,
    parseSentryIngestOrigin(env.NEXT_PUBLIC_SENTRY_DSN),
  ])

  const directives = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "script-src": scriptSrc,
    "style-src": unique(["'self'", "'unsafe-inline'", ...STATIC_STYLE_HOSTS]),
    "font-src": unique(["'self'", ...STATIC_FONT_HOSTS]),
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "connect-src": connectSrc,
    "frame-src": unique([
      "'self'",
      ...STATIC_FRAME_HOSTS,
      parseFirebaseAuthOrigin(env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    ]),
    "worker-src": ["'self'", "blob:"],
  }

  const reportUri = options.reportUri ?? env.CSP_REPORT_URI?.trim()
  if (reportUri) {
    directives["report-uri"] = [reportUri]
  }

  return formatDirectives(directives)
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @param {{ mode?: 'report-only' | 'enforce'; reportUri?: string; skip?: boolean }} [options]
 * @returns {{ key: string; value: string } | null}
 */
function getContentSecurityPolicyHeader(env = process.env, options = {}) {
  const policy = buildContentSecurityPolicy(env, options)
  if (!policy) return null

  const reportOnly =
    options.mode === "report-only" ||
    (options.mode !== "enforce" &&
      env.CSP_REPORT_ONLY !== "false" &&
      env.CSP_REPORT_ONLY !== "0")

  return {
    key: reportOnly
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy",
    value: policy,
  }
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ key: string; value: string } | null}
 */
function getStrictTransportSecurityHeader(env = process.env) {
  if (env.NODE_ENV !== "production") return null
  if (env.ELECTRON === "true") return null
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "production") return null

  return {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  }
}

/**
 * @returns {{ key: string; value: string }}
 */
function getPermissionsPolicyHeader() {
  return {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  }
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @param {{ mode?: 'report-only' | 'enforce'; reportUri?: string; skip?: boolean }} [options]
 * @returns {{ key: string; value: string }[]}
 */
function getProductionSecurityHeaders(env = process.env, options = {}) {
  const headers = []

  const csp = getContentSecurityPolicyHeader(env, options)
  if (csp) headers.push(csp)

  const hsts = getStrictTransportSecurityHeader(env)
  if (hsts) headers.push(hsts)

  if (env.NODE_ENV === "production" && env.ELECTRON !== "true") {
    headers.push(getPermissionsPolicyHeader())
  }

  return headers
}

module.exports = {
  buildContentSecurityPolicy,
  getContentSecurityPolicyHeader,
  getStrictTransportSecurityHeader,
  getPermissionsPolicyHeader,
  getProductionSecurityHeaders,
  parseOrigin,
  parseSentryIngestOrigin,
}
