import { NextResponse } from "next/server";

/** Public Firebase client config (apiKey etc. are not secret). */
export async function GET() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();

  if (!apiKey || !authDomain || !projectId) {
    return NextResponse.json(
      { message: "Firebase is not configured" },
      { status: 503 },
    );
  }

  return NextResponse.json({ apiKey, authDomain, projectId });
}
