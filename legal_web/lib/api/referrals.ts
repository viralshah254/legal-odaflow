import { apiFetch } from "./client"
import { buildReferralShareUrl } from "@/lib/app-url"

export interface ReferralStats {
  signedUp?: number
  pending: number
  subscribed: number
  rewarded: number
  totalCreditsEarned: number
}

export interface MyReferralInfo {
  code: string
  shareUrl: string
  stats: ReferralStats
}

export async function getMyReferralInfo(): Promise<MyReferralInfo> {
  const info = await apiFetch<MyReferralInfo>("/referrals/me")
  return {
    ...info,
    shareUrl: buildReferralShareUrl(info.code),
  }
}

export async function applyReferralCode(
  code: string,
  deviceFingerprint?: string | null,
): Promise<{ attributed: boolean; referrerUserId?: string }> {
  return apiFetch("/referrals/apply", {
    method: "POST",
    body: { code, deviceFingerprint: deviceFingerprint ?? undefined },
  })
}

export interface ReferralPreview {
  valid: true
  referrerDisplayName: string
  userType: string
}

export async function getReferralPreview(
  code: string,
): Promise<ReferralPreview | { valid: false }> {
  return apiFetch<ReferralPreview | { valid: false }>(
    `/referrals/preview?code=${encodeURIComponent(code)}`,
    { auth: false },
  )
}

export async function registerDeviceFingerprint(
  fingerprint: string,
  source: "signup" | "checkout" | "login",
): Promise<void> {
  await apiFetch("/referrals/device", {
    method: "POST",
    body: { fingerprint, source },
  })
}
