export function getBackendPublicOrigin(): string {
  const directOrigin = resolveDirectBrowserApiOrigin()
  if (directOrigin) {
    return directOrigin
  }

  if (typeof window !== "undefined") {
    const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")
    if (configured) {
      return configured
    }

    const host = window.location.hostname
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:4000"
    }

    return window.location.origin
  }

  return resolveBackendOrigin()
}

/**
 * On Vercel, set API_URL to your deployed NestJS host (no /api/v1 suffix).
 */
import {
  isDeveloperFacingErrorMessage,
  USER_CONNECTION_ERROR,
} from "@/lib/errors/user-facing-messages"
function resolveBackendOrigin(): string {
  const base =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000"
  return base.replace(/\/$/, "")
}

function resolveDirectBrowserApiOrigin(): string | null {
  if (
    process.env.NEXT_PUBLIC_USE_DIRECT_API === "true" &&
    process.env.NEXT_PUBLIC_API_URL
  ) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")
  }

  return null
}

/**
 * Browser calls same-origin /api/v1; Next.js rewrites to the backend (no CORS).
 * Set NEXT_PUBLIC_USE_DIRECT_API=true to call the backend from the browser (long AI calls).
 * Server components use the full backend URL.
 */
export function getApiBaseUrl(): string {
  const directOrigin = resolveDirectBrowserApiOrigin()
  if (directOrigin) {
    return `${directOrigin}/api/v1`
  }

  if (typeof window !== "undefined") {
    return "/api/v1"
  }

  return `${resolveBackendOrigin()}/api/v1`
}

/** Socket.IO namespace URL for tenant realtime events. */
export function getRealtimeSocketUrl(): string {
  if (typeof window !== "undefined") {
    // 1. Explicit WS override
    const configured = process.env.NEXT_PUBLIC_WS_URL
    if (configured) return configured.replace(/\/$/, "")

    // 2. Dev direct-API mode
    const directOrigin = resolveDirectBrowserApiOrigin()
    if (directOrigin) return directOrigin

    const host = window.location.hostname
    const isLocal = host === "localhost" || host === "127.0.0.1"
    if (isLocal) return "http://127.0.0.1:4000"

    // 3. On deployed frontends (e.g. Vercel), the frontend and backend are on
    //    different domains. window.location.origin points to Vercel, which has
    //    no WebSocket support and causes perpetual "Connecting".
    //    Use NEXT_PUBLIC_API_URL when it resolves to a non-local host.
    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")
    if (apiUrl && !/localhost|127\.0\.0\.1/.test(apiUrl)) {
      return apiUrl
    }

    // 4. Same-origin fallback (only valid when frontend and backend share a host)
    return window.location.origin
  }

  return `${resolveBackendOrigin()}`
}

export function getApiConfigurationHint(): string | null {
  if (typeof window === "undefined") {
    return null
  }
  return USER_CONNECTION_ERROR
}

export function wrapFetchError(error: unknown): Error {
  if (error instanceof TypeError && /fetch|network|failed/i.test(error.message)) {
    return new Error(USER_CONNECTION_ERROR)
  }
  if (error instanceof Error && isDeveloperFacingErrorMessage(error.message)) {
    return new Error(USER_CONNECTION_ERROR)
  }
  return error instanceof Error ? error : new Error("Something went wrong.")
}
