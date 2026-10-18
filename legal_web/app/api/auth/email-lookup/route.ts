import { NextRequest, NextResponse } from "next/server"
import { backendApiUrl } from "@/lib/auth/backend-origin.server"
import { USER_CONNECTION_ERROR } from "@/lib/errors/user-facing-messages"

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text()
  let upstream: Response
  try {
    upstream = await fetch(backendApiUrl("/auth/email-lookup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    })
  } catch {
    return NextResponse.json({ message: USER_CONNECTION_ERROR }, { status: 502 })
  }
  const data = await upstream.json().catch(() => ({}))
  return NextResponse.json(data, { status: upstream.status })
}
