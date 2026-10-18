import { NextRequest, NextResponse } from 'next/server'
import {
  buildSignInRedirect,
  isProtectedRoute,
  isSessionRefreshRoute,
  validateMiddlewareSession,
} from '@/lib/auth/middleware-auth.server'
import { setAuthSessionCookies } from '@/lib/auth/session-cookies.server'
import { usesCookieSessionOnServer } from '@/lib/auth/session-config'
import {
  LOCALE_COOKIE_NAME,
  normalizeLocale,
  SUPPORTED_LOCALE_CODES,
} from '@/lib/i18n/locales'
import { isNoIndexPath } from '@/lib/seo/private-routes'
import {
  isLocalFirebaseAuthProxyHost,
  proxyFirebaseAuthHandler,
} from '@/lib/auth/firebase-auth-proxy.server'
import {
  buildFirebaseInitJson,
  resolveFirebaseInitAuthDomain,
} from '@/lib/auth/firebase-init-json.server'

function applyLocaleCookie(request: NextRequest, response: NextResponse): void {
  const existing = request.cookies.get(LOCALE_COOKIE_NAME)?.value
  if (existing) return

  const acceptLanguage = request.headers.get('accept-language')
  if (!acceptLanguage) return

  const preferred = acceptLanguage
    .split(',')
    .map((part) => part.split(';')[0]?.trim())
    .filter(Boolean)

  for (const tag of preferred) {
    const base = normalizeLocale(tag)
    if (SUPPORTED_LOCALE_CODES.includes(base)) {
      response.cookies.set(LOCALE_COOKIE_NAME, base, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
      break
    }
  }
}

export default async function middleware(request: NextRequest) {
  if (process.env.ELECTRON === 'true') {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl

  const host = request.headers.get("host") ?? ""
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  let canonicalHost: string | null = null
  if (appUrl) {
    try {
      canonicalHost = new URL(appUrl).host.toLowerCase()
    } catch {
      canonicalHost = null
    }
  }
  const isApexOkaylegal =
    host.toLowerCase() === "okaylegal.ai" || host.toLowerCase() === "www.okaylegal.ai"
  if (
    canonicalHost &&
    isApexOkaylegal &&
    host.toLowerCase() !== canonicalHost &&
    (pathname === "/auth" ||
      pathname.startsWith("/auth/") ||
      pathname.startsWith("/__/auth") ||
      pathname === "/__/firebase/init.json")
  ) {
    const url = request.nextUrl.clone()
    url.host = canonicalHost
    url.protocol = "https:"
    return NextResponse.redirect(url, 308)
  }

  if (pathname === "/__/firebase/init.json") {
    const host = request.headers.get("host") ?? ""
    const authDomain = resolveFirebaseInitAuthDomain(host)
    if (authDomain) {
      return NextResponse.json(buildFirebaseInitJson(authDomain), {
        headers: {
          "Cache-Control": "public, max-age=3600",
        },
      })
    }
  }

  // Firebase Auth helper: never serve /__/auth/handler/ (trailing slash breaks
  // relative handler.js / experiments.js and leaves a blank page).
  // Force SAMEORIGIN so a catch-all DENY (or upstream proxy headers) cannot
  // block Firebase's same-origin auth iframe / redirect return.
  if (pathname.startsWith("/__/auth")) {
    if (pathname.length > "/__/auth".length && pathname.endsWith("/")) {
      const url = request.nextUrl.clone()
      url.pathname = pathname.replace(/\/+$/, "") || "/__/auth/handler"
      return NextResponse.redirect(url, 308)
    }

    const host = request.headers.get("host") ?? ""
    if (
      process.env.NODE_ENV === "development" &&
      isLocalFirebaseAuthProxyHost(host)
    ) {
      const proxied = await proxyFirebaseAuthHandler(request, pathname)
      if (proxied) return proxied
    }

    const response = NextResponse.next()
    response.headers.set("X-Frame-Options", "SAMEORIGIN")
    response.headers.delete("Content-Security-Policy")
    response.headers.delete("Content-Security-Policy-Report-Only")
    return response
  }

  // Do NOT force trailing slashes here. skipTrailingSlashRedirect is enabled so
  // Firebase auth helpers stay without a slash; Next Link still generates
  // trailingSlash URLs for app pages. Manually redirecting /auth → /auth/ caused
  // ERR_TOO_MANY_REDIRECTS (Location got normalized back to /auth).

  if (pathname === '/consumer/fir-analysis' || pathname.startsWith('/consumer/fir-analysis/')) {
    return NextResponse.redirect(new URL('/consumer/dashboard/', request.url))
  }

  // Legacy referral links were generated as /auth?ref=CODE or /auth/sign-up?ref=CODE.
  // Redirect them to the landing page so invitees see the product before being asked to sign up.
  // Only redirect when ?ref is present and there is no ?redirect (which would be a protected-route
  // auth challenge, not a referral entry point).
  // In-flow sign-up from /auth email Continue carries ?email= — allow that through.
  const isInFlowSignUp =
    (pathname === '/auth/sign-up' || pathname === '/auth/sign-up/') &&
    request.nextUrl.searchParams.has('email')
  if (
    !isInFlowSignUp &&
    (pathname === '/auth' || pathname === '/auth/' || pathname === '/auth/sign-up' || pathname === '/auth/sign-up/') &&
    request.nextUrl.searchParams.has('ref') &&
    !request.nextUrl.searchParams.has('redirect')
  ) {
    const ref = request.nextUrl.searchParams.get('ref')!
    const landingUrl = new URL('/', request.url)
    landingUrl.searchParams.set('ref', ref)
    return NextResponse.redirect(landingUrl)
  }

  if (
    usesCookieSessionOnServer(request.nextUrl.hostname) &&
    isSessionRefreshRoute(pathname)
  ) {
    const session = await validateMiddlewareSession(request)
    const response = NextResponse.next()
    if (session.newTokens) {
      setAuthSessionCookies(response, session.newTokens.accessToken, session.newTokens.refreshToken)
    }
    applyLocaleCookie(request, response)
    return response
  }

  if (
    usesCookieSessionOnServer(request.nextUrl.hostname) &&
    isProtectedRoute(pathname)
  ) {
    const session = await validateMiddlewareSession(request)
    if (!session.ok) {
      const redirect = buildSignInRedirect(request)
      applyLocaleCookie(request, redirect)
      return redirect
    }
    // Silent token refresh: middleware rotated the tokens on the backend,
    // so we MUST write the new tokens to cookies before continuing —
    // otherwise the old (already-consumed) refresh token stays in the
    // browser and the very next /api/auth/session/ call will 401 and
    // log the user out.
    if (session.newTokens) {
      const response = NextResponse.next()
      setAuthSessionCookies(response, session.newTokens.accessToken, session.newTokens.refreshToken)
      applyLocaleCookie(request, response)
      return response
    }
  }

  const response = NextResponse.next()
  applyLocaleCookie(request, response)
  return response
}

export const config = {
  // Include /__/auth so we can strip trailing slashes; still skip static assets
  // with file extensions except we need middleware for /__/auth/*/ paths only.
  matcher: [
    "/__/auth",
    "/__/auth/:path*",
    "/__/firebase/init.json",
    "/((?!api|_next|_vercel|__/auth|.*\\..*).*)",
  ],
}
