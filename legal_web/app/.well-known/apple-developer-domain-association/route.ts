import { NextResponse } from "next/server"
import { getAppleDomainAssociationBody } from "@/lib/apple/domain-association"

export const dynamic = "force-dynamic"

export function GET(): NextResponse {
  const body = getAppleDomainAssociationBody()
  if (!body) {
    return NextResponse.json(
      {
        message:
          "Apple domain association is not configured. Set APPLE_DOMAIN_ASSOCIATION or add public/.well-known/apple-developer-domain-association.",
      },
      { status: 404 },
    )
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
