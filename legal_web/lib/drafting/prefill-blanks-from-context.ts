import {
  extractDraftFieldHints,
  type DraftFieldHintContext,
} from "@/lib/india-drafting/extract-field-hints"
import { extractBlankLabelsFromDraft } from "@/lib/drafting/draft-text-formatter"

export interface PrefillBlankContext {
  caseDetails: string
  clientName?: string
  courtName?: string
  opposingParty?: string
  hintContext?: DraftFieldHintContext
  /** Optional confirmed CaseRecord chronology / money (never overwrite user values). */
  caseRecord?: {
    chronology?: Array<{ label: string; date?: string }>
    moneyRecords?: Array<{ kind: string; amountLabel: string; description?: string }>
    parties?: Array<{ role: string; name: string }>
  }
}

const FIR_NO_RE = /\bFIR\s*(?:No\.?|Number|#)?\s*[:=]?\s*([A-Za-z0-9\/\-]+)/i
const PS_RE =
  /\b(?:P\.?S\.?|Police\s+Station)\s*[:=]?\s*([A-Za-z][A-Za-z\s.]{2,40})/i
const FIR_DATE_RE =
  /\bFIR\b[\s\S]{0,60}?(?:dated|on|dt\.?)\s*[:=]?\s*([^\n.;,]{4,40})/i
const ARREST_DATE_RE =
  /\b(?:arrest(?:ed)?|taken\s+into\s+custody)\b[\s\S]{0,40}?(?:on|dated|dt\.?)\s*[:=]?\s*([^\n.;,]{4,40})/i
const SECTIONS_RE =
  /\b(?:sections?|u\/s|under\s+sections?)\s*[:=]?\s*([A-Za-z0-9§,\s\/\-]+(?:BNS|BNSS|IPC|CrPC|POCSO|NDPS)?[A-Za-z0-9§,\s\/\-]*)/i

const CONSENT_DATE_RE =
  /\bconsent\b[\s\S]{0,60}?(?:on|dated|dt\.?)\s*[:=]?\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
const SURGERY_DATE_RE =
  /\b(?:surgery|operated|cholecystectomy|gallbladder)\b[\s\S]{0,60}?(?:on|dated|dt\.?)\s*[:=]?\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
const CT_DATE_RE =
  /\b(?:CT|scan|MRI)\b[\s\S]{0,60}?(?:on|dated|performed\s+on|dt\.?)\s*[:=]?\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
const TRANSFER_DATE_RE =
  /\b(?:transfer(?:red)?|referred)\b[\s\S]{0,60}?(?:on|dated|dt\.?)\s*[:=]?\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
const AMOUNT_RE = /(?:₹|Rs\.?\s*)\s*([\d,]+(?:\.\d+)?)/i
const ADDRESS_RE =
  /\b(?:residing\s+at|address[:\s]+)\s*([^\n.]{8,80})/i

function stripBlankPrefix(label: string): string {
  return label.replace(/^BLANK:\s*/i, "").trim().toLowerCase()
}

function cleanExtracted(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function extractCaseFacts(caseDetails: string): {
  firNo?: string
  policeStation?: string
  firDate?: string
  arrestDate?: string
  sections?: string
  consentDate?: string
  surgeryDate?: string
  ctDate?: string
  transferDate?: string
  amount?: string
  address?: string
} {
  const text = caseDetails.trim()
  if (!text) return {}
  const amountMatch = text.match(AMOUNT_RE)
  return {
    firNo: cleanExtracted(text.match(FIR_NO_RE)?.[1]),
    policeStation: cleanExtracted(text.match(PS_RE)?.[1]),
    firDate: cleanExtracted(text.match(FIR_DATE_RE)?.[1]),
    arrestDate: cleanExtracted(text.match(ARREST_DATE_RE)?.[1]),
    sections: cleanExtracted(text.match(SECTIONS_RE)?.[1]),
    consentDate: cleanExtracted(text.match(CONSENT_DATE_RE)?.[1]),
    surgeryDate: cleanExtracted(text.match(SURGERY_DATE_RE)?.[1]),
    ctDate: cleanExtracted(text.match(CT_DATE_RE)?.[1]),
    transferDate: cleanExtracted(text.match(TRANSFER_DATE_RE)?.[1]),
    amount: amountMatch ? `₹${amountMatch[1]}` : undefined,
    address: cleanExtracted(text.match(ADDRESS_RE)?.[1]),
  }
}

function chronologyDate(ctx: PrefillBlankContext, re: RegExp): string {
  for (const e of ctx.caseRecord?.chronology ?? []) {
    if (re.test(e.label) && e.date) return e.date
  }
  return ""
}

/** Map a blank label to a known value from form fields + case narrative. */
export function resolveBlankValueFromContext(
  label: string,
  ctx: PrefillBlankContext,
): string {
  const key = stripBlankPrefix(label)
  if (!key) return ""

  const hints = extractDraftFieldHints(ctx.caseDetails ?? "", ctx.hintContext)
  const client = ctx.clientName?.trim() || hints.clientName || ""
  const opposing = ctx.opposingParty?.trim() || hints.opposingParty || ""
  const court = ctx.courtName?.trim() || hints.courtName || ""
  const facts = extractCaseFacts(ctx.caseDetails ?? "")

  if (
    /\b(accused|applicant|client|petitioner|deponent|applicant[-–]?accused|complainant)\b/.test(
      key,
    )
  ) {
    return client
  }

  if (/\b(state|respondent|opposing|prosecution|opposite\s+party)\b/.test(key)) {
    return opposing
  }

  if (/\b(court|forum|seat|magistrate|sessions|district\s+court|commission)\b/.test(key)) {
    return court
  }

  if (/\bfir\s*(no|number|#)\b|\bfir\s*no\b/.test(key) || key === "fir no") {
    return facts.firNo || ""
  }

  if (/\bpolice\s*station|\bp\.?s\.?\b/.test(key)) {
    return facts.policeStation || ""
  }

  if (/\bfir\s*date\b/.test(key)) {
    return facts.firDate || ""
  }

  if (/\barrest\s*date|date\s*of\s*arrest\b/.test(key)) {
    return facts.arrestDate || ""
  }

  if (/\bsections?\b|provisions?\s*charged|offences?\s*charged/.test(key)) {
    return facts.sections || ""
  }

  if (/\bconsent\b/.test(key)) {
    return chronologyDate(ctx, /consent/i) || facts.consentDate || ""
  }

  if (/\b(surgery|procedure|operation|gallbladder|cholecystectomy)\b/.test(key)) {
    return chronologyDate(ctx, /surgery|procedure/i) || facts.surgeryDate || ""
  }

  if (/\b(ct|scan|imaging|mri)\b/.test(key)) {
    return chronologyDate(ctx, /ct|imaging|scan/i) || facts.ctDate || ""
  }

  if (/\btransfer\b/.test(key)) {
    return chronologyDate(ctx, /transfer/i) || facts.transferDate || ""
  }

  if (/\b(amount|compensation|estimate|₹|rs\.?|rupees?)\b/.test(key)) {
    const fromRecord = ctx.caseRecord?.moneyRecords?.find((m) =>
      /estimate|claim|expense/i.test(m.kind),
    )?.amountLabel
    return fromRecord || facts.amount || ""
  }

  if (/\b(address|residence|residing)\b/.test(key)) {
    return facts.address || ""
  }

  if (/designation of court|name of court|court name/.test(key)) {
    return court
  }

  return ""
}

/**
 * Prefill empty blank slots from already-known case details / form fields.
 * Does not call the paid fill-blanks API. Leaves unknown slots empty.
 * Never overwrites a user-confirmed (non-empty) blank value.
 */
export function prefillBlanksFromContext(
  draft: string,
  blanks: string[],
  ctx: PrefillBlankContext,
): string[] {
  const labels = extractBlankLabelsFromDraft(draft)
  const next = [...blanks]
  while (next.length < labels.length) next.push("")

  labels.forEach((label, i) => {
    if (next[i]?.trim()) return
    const value = resolveBlankValueFromContext(label, ctx)
    if (value) next[i] = value
  })

  return next
}
