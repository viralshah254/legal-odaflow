import { NextResponse } from "next/server"
import { refreshAuthSession } from "@/lib/auth/auth-session.server"

export async function POST(): Promise<NextResponse> {
  return refreshAuthSession()
}
