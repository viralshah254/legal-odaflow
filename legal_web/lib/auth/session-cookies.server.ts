import type { NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE,
  PORTAL_CLIENT_COOKIE,
  PORTAL_TOKEN_COOKIE,
  PORTAL_TOKEN_MAX_AGE,
  cookieOptions,
} from "./session-config"

export function setAuthSessionCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
): void {
  response.cookies.set(
    ACCESS_TOKEN_COOKIE,
    accessToken,
    cookieOptions(ACCESS_TOKEN_MAX_AGE),
  )
  response.cookies.set(
    REFRESH_TOKEN_COOKIE,
    refreshToken,
    cookieOptions(REFRESH_TOKEN_MAX_AGE),
  )
}

export function clearAuthSessionCookies(response: NextResponse): void {
  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]) {
    response.cookies.set(name, "", { ...cookieOptions(0), maxAge: 0 })
  }
}

export function setPortalSessionCookies(
  response: NextResponse,
  portalToken: string,
  clientId: string,
): void {
  response.cookies.set(
    PORTAL_TOKEN_COOKIE,
    portalToken,
    cookieOptions(PORTAL_TOKEN_MAX_AGE),
  )
  response.cookies.set(
    PORTAL_CLIENT_COOKIE,
    clientId,
    cookieOptions(PORTAL_TOKEN_MAX_AGE),
  )
}

export function clearPortalSessionCookies(response: NextResponse): void {
  for (const name of [PORTAL_TOKEN_COOKIE, PORTAL_CLIENT_COOKIE]) {
    response.cookies.set(name, "", { ...cookieOptions(0), maxAge: 0 })
  }
}

export async function readAccessTokenFromCookies(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(ACCESS_TOKEN_COOKIE)?.value ?? null
}

export async function readRefreshTokenFromCookies(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(REFRESH_TOKEN_COOKIE)?.value ?? null
}

export async function readPortalTokenFromCookies(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(PORTAL_TOKEN_COOKIE)?.value ?? null
}

export function bearerFromRequestCookies(
  cookieHeader: string | null,
  names: string[],
): string | null {
  if (!cookieHeader) return null
  for (const name of names) {
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
    if (match?.[1]) return decodeURIComponent(match[1])
  }
  return null
}
