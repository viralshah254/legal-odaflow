import { NextRequest, NextResponse } from "next/server"
import { proxyAuthenticatedAuthPost } from "@/lib/auth/auth-session.server"

export async function POST(req: NextRequest): Promise<NextResponse> {
  return proxyAuthenticatedAuthPost(req, "/auth/change-password")
}
