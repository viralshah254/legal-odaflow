import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth/auth-session.server"

export async function GET(): Promise<NextResponse> {
  return getAuthSession()
}
