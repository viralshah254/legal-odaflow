import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
/** Public deployment provenance only. Never return credentials or tenant data. */
export function GET() {
  const configured = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || ''
  let backendOrigin: string | null = null
  try { backendOrigin = new URL(configured).origin } catch { /* local unset config */ }
  return NextResponse.json({ gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || null, backendOrigin }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
