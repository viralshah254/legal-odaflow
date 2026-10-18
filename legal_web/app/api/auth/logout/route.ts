import { NextResponse } from "next/server"
import { logoutAuthSession } from "@/lib/auth/auth-session.server"

export async function POST(): Promise<NextResponse> {
  return logoutAuthSession()
}
