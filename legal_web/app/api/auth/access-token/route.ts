import { NextResponse } from "next/server"
import { readAccessTokenFromCookies } from "@/lib/auth/session-cookies.server"

/** Bridge for Socket.IO / blob downloads that need a Bearer token in cookie-auth mode. */
export async function GET(): Promise<NextResponse> {
  const token = await readAccessTokenFromCookies()
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 })
  }
  return NextResponse.json({ token })
}
