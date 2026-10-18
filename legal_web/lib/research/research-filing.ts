import type { LegalResearchResponse } from "@/lib/api/types"
import {
  buildResearchVerificationAppendix,
  getResearchRelianceState,
} from "@/lib/api/verification"

export interface ResearchMatterPrefill {
  title: string
  practiceArea: string
  factsSummary: string
  desiredOutcome: string
  sourceResearchId: string
  countryCode: string
  clientId?: string
}

const PRACTICE_AREA_HINTS: Array<[string, RegExp]> = [
  ["criminal_defense", /\b(criminal|bail|arrest|prosecution|offence|offense|fir)\b/i],
  ["family_matrimonial", /\b(divorce|custody|matrimonial|maintenance|adoption|family)\b/i],
  ["employment_labour", /\b(employment|employee|labou?r|workplace|dismissal|termination)\b/i],
  ["real_estate_property", /\b(property|real estate|land|lease|tenant|title deed)\b/i],
  ["immigration", /\b(immigration|visa|citizenship|deportation|asylum)\b/i],
  ["intellectual_property", /\b(trademark|copyright|patent|intellectual property)\b/i],
  ["tax", /\b(tax|gst|vat|income tax|customs)\b/i],
  ["wills_estates_probate", /\b(will|estate|probate|succession|inheritance)\b/i],
  ["corporate_commercial", /\b(company|corporate|contract|shareholder|commercial|merger)\b/i],
]

function cleanInline(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function truncate(value: string, length: number): string {
  const cleaned = cleanInline(value)
  return cleaned.length <= length ? cleaned : `${cleaned.slice(0, length - 1).trimEnd()}…`
}

function practicalStepText(result: LegalResearchResponse): string | undefined {
  const first = result.structuredDraft?.practicalSteps?.[0]
  if (typeof first === "string") return first
  return first?.action ?? first?.step
}

export function inferResearchPracticeArea(query: string): string {
  return PRACTICE_AREA_HINTS.find(([, pattern]) => pattern.test(query))?.[0]
    ?? "litigation_disputes"
}

export function buildResearchMatterPrefill(input: {
  query: string
  result: LegalResearchResponse
  countryCode: string
  sourceResearchId?: string
  clientId?: string
}): ResearchMatterPrefill {
  const directAnswer =
    input.result.structuredDraft?.directAnswer?.text
    ?? input.result.structuredDraft?.shortAnswer?.text
    ?? input.result.answer
  return {
    title: truncate(input.query, 120),
    practiceArea: inferResearchPracticeArea(input.query),
    factsSummary: truncate(
      `AI-proposed research context — not confirmed client facts. Research question: ${input.query}. Memo context: ${directAnswer}`,
      1_500,
    ),
    desiredOutcome: truncate(
      practicalStepText(input.result)
        ?? `Confirm the client's objective after reviewing the research findings for: ${input.query}`,
      600,
    ),
    sourceResearchId: input.sourceResearchId ?? "",
    countryCode: input.countryCode,
    clientId: input.clientId,
  }
}

export function buildNewMatterResearchHref(prefill: ResearchMatterPrefill): string {
  const params = new URLSearchParams({
    aiProposed: "1",
    title: prefill.title,
    practiceArea: prefill.practiceArea,
    factsSummary: prefill.factsSummary,
    desiredOutcome: prefill.desiredOutcome,
    sourceResearchId: prefill.sourceResearchId,
    country: prefill.countryCode,
  })
  if (prefill.clientId) params.set("clientId", prefill.clientId)
  return `/app/matters/new?${params.toString()}`
}

export function buildResearchDocument(input: {
  title: string
  query: string
  countryCode?: string
  result: LegalResearchResponse
  aiOutputId?: string
  generatedAt?: string
}): { contents: string; fileName: string; draftOnly: boolean } {
  const relianceState = getResearchRelianceState({
    audit: input.result.citationAudit,
    findings: input.result.findings,
    publicationState: input.result.publicationState,
    researchMode: input.result.researchMode,
  })
  const draftOnly = relianceState !== "source-verified"
  const heading = draftOnly
    ? `# UNVERIFIED DRAFT — ${input.title}`
    : `# ${input.title}`
  const citations = input.result.citations.length
    ? input.result.citations.map((citation, index) => {
        const source = citation.source ? ` — ${citation.source}` : ""
        const link = citation.url ? ` ([open source](${citation.url}))` : ""
        return `${index + 1}. ${citation.title}${source}${link}`
      }).join("\n")
    : "_No citations were supplied._"
  const appendix = buildResearchVerificationAppendix({
    audit: input.result.citationAudit,
    findings: input.result.findings,
    publicationState: input.result.publicationState,
    researchMode: input.result.researchMode,
  })
  const provenance = [
    "## Provenance",
    "",
    `- AI output ID: ${input.aiOutputId || "not available"}`,
    `- Generated at: ${input.generatedAt || input.result.generatedAt || new Date().toISOString()}`,
    `- Country: ${input.countryCode || input.result.jurisdiction || "not specified"}`,
    `- Research query: ${input.query}`,
    `- Filing state: ${draftOnly ? "UNVERIFIED DRAFT — manual verification required" : "source-verified research memo"}`,
  ].join("\n")
  const contents = [
    heading,
    "",
    draftOnly
      ? "> UNVERIFIED DRAFT — NOT FOR RELIANCE. This watermark must not be removed until verification is complete."
      : "> AI-assisted legal research. Lawyer confirmation remains required before filing or advice.",
    "",
    `**Research query:** ${input.query}`,
    "",
    "## Research memo",
    "",
    input.result.answer || "_No memo content was generated._",
    "",
    "## Citations",
    "",
    citations,
    "",
    appendix,
    "",
    provenance,
    "",
  ].join("\n")
  const base = input.title
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    || "legal-research"
  return {
    contents,
    fileName: `${draftOnly ? "UNVERIFIED-DRAFT-" : ""}${base}.md`,
    draftOnly,
  }
}
