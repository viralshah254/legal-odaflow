import { ApiClientError, authorizedFetch, resolveAccessToken } from "./client"
import { validateUploadFile } from "@/lib/security/validate-upload-file"
import { usesCookieSession } from "@/lib/auth/session-config"
import { getMemoryAccessToken } from "@/lib/auth/token-store"
import type { SectionFinderEntry } from "./section-finder"

export interface FirExtractedField<T = string> {
  value: T | null
  confidence: "high" | "medium" | "low" | "missing"
  raw?: string
}

export interface FirExtractedFacts {
  firNumber: FirExtractedField
  policeStation: FirExtractedField
  district: FirExtractedField
  state: FirExtractedField
  dateOfOccurrence: FirExtractedField
  dateOfFiling: FirExtractedField
  complainant: FirExtractedField
  accused: FirExtractedField<string[]>
  allegedOffences: FirExtractedField<string[]>
  sections: FirExtractedField<string[]>
  arrestStatus: FirExtractedField<"arrested" | "not_arrested" | "warrant_issued" | "unknown">
  factsNarrative: FirExtractedField
  propertyInvolved: FirExtractedField
  amountInvolved: FirExtractedField
  witnesses: FirExtractedField<string[]>
  missingFields: string[]
  documentQuality: "clear" | "partial" | "poor"
}

export interface FirNextStep {
  step: string
  priority: "urgent" | "high" | "medium" | "low"
  category: "bail" | "documents" | "procedure" | "research" | "draft" | "timeline" | "defect"
  details: string
}

export interface FirExtractionResult {
  extractedFacts: FirExtractedFacts
  nextSteps: FirNextStep[]
  suggestedResearchQuery: string
  suggestedDraftTypes: string[]
  bailPostureSummary: string
  riskFlags: string[]
  countryCode: string
  disclaimer: string
  resolvedSections?: SectionFinderEntry[]
}

async function assertFirAuth(): Promise<void> {
  if (usesCookieSession()) {
    const token = await resolveAccessToken()
    if (!token) {
      throw new ApiClientError("Sign in required to analyze FIR documents", 401)
    }
    return
  }

  if (!getMemoryAccessToken()) {
    throw new ApiClientError("Sign in required to analyze FIR documents", 401)
  }
}

export async function uploadFirFile(
  file: File,
  countryCode = "IN",
): Promise<FirExtractionResult> {
  await validateUploadFile(file, "firDocument")
  await assertFirAuth()

  const formData = new FormData()
  formData.append("file", file)
  formData.append("countryCode", countryCode)

  const res = await authorizedFetch("/ai/fir/upload/", {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new ApiClientError(
      (err as { message?: string }).message ?? "FIR extraction failed",
      res.status,
      err,
    )
  }

  return res.json() as Promise<FirExtractionResult>
}

export async function extractFirFromText(
  extractedText: string,
  countryCode = "IN",
): Promise<FirExtractionResult> {
  await assertFirAuth()

  const res = await authorizedFetch("/ai/fir/extract/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extractedText, countryCode }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new ApiClientError(
      (err as { message?: string }).message ?? "FIR extraction failed",
      res.status,
      err,
    )
  }

  return res.json() as Promise<FirExtractionResult>
}
