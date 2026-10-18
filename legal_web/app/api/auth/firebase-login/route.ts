import { NextRequest, NextResponse } from "next/server"
import { proxyAuthPost } from "@/lib/auth/auth-session.server"

export async function POST(req: NextRequest): Promise<NextResponse> {
  return proxyAuthPost(req, "/auth/firebase/login")
}
