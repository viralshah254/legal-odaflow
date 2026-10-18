/** Extract party / court hints from pasted case narratives for draft form prefill. */

/**
 * Honorific + name. Honorific listed in both cases (no inline (?i:) — not portable).
 * Name tokens must look like names (capitalized words or short initials) — not
 * arbitrary lowercase narrative. Allows "Mr k" / "Ms s" and "Mrs. Kavita Shah";
 * rejects "Ms he offered to refund".
 */
/** Case-flexible honorifics without inline (?i:) groups. */
const HONORIFIC =
  "(?:[Mm]rs?|[Mm]s|[Mm]iss|[Mm]r|[Ss]hri|[Ss]mt|[Dd]r)"
/** Prefer capitalized full names; fall back to 1–2 letter initials ("Mr k"). */
const PERSON_NAME =
  "(?:[A-Z][a-zA-Z']*(?:\\s+[A-Z][a-zA-Z']*){0,3}|[A-Za-z](?:\\s+[A-Za-z])?)"
const PERSON = `${HONORIFIC}\\.?\\s+${PERSON_NAME}`

const INDIAN_CITIES =
  "Ahmedabad|Mumbai|Pune|Delhi|New Delhi|Bengaluru|Bangalore|Chennai|Hyderabad|Kolkata|Jaipur|Lucknow|Surat|Noida|Gurugram|Chandigarh"

/** Up to five name tokens per side — matches "State v. Rohan Mehta". */
const PARTY_NAME = String.raw`[A-Za-z][A-Za-z.']*(?:\s+[A-Za-z][A-Za-z.']*){0,4}`

const VS_CAPTION = new RegExp(
  String.raw`\b(${PARTY_NAME})\s+(?:vs\.?|v\.?|versus)\s+(${PARTY_NAME})\b`,
  "i",
)

const ACCUSED_BLOCK =
  /\bAccused\s*:\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})(?:\s*[,.]|\s+aged|\s*$)/im

/** Stop tokens after a labeled party name (address / age / role narrative). */
const LABEL_NAME_STOP =
  "(?=\\s*[,.]|\\s+aged|\\s+residing|\\s+r/o|\\s+son\\s+of|\\s+daughter\\s+of|\\s+s/o|\\s+d/o|\\s+w/o|\\s+consultant|\\s+of\\s+|\\s*$|\\n)"

/** Captured labeled name: optional Dr. + up to 8 Capitalized tokens (persons and orgs).
 *  Must stay case-sensitive so narrative words like "residing"/"at" are not swallowed.
 *  Use horizontal whitespace only so the next section heading (e.g. "Facts") is not swallowed. */
const LABELED_NAME =
  String.raw`(?:Dr\.?[^\S\n]+)?[A-Z][A-Za-z.']*(?:[^\S\n]+[A-Z][A-Za-z.']*){0,7}`

/** Plaintiff / Petitioner / Complainant / Purchaser / Buyer No. N: Name */
const LABELED_PLAINTIFF_RE = new RegExp(
  String.raw`\b((?:Plaintiff|Petitioner|Complainant|Purchaser|Buyer|plaintiff|petitioner|complainant|purchaser|buyer))(?:\s+No\.?\s*\d+)?\s*:\s*(${LABELED_NAME})${LABEL_NAME_STOP}`,
  "gm",
)

/** Defendant / Respondent / Opposite Party / Vendor / Seller No. N: Name */
const LABELED_DEFENDANT_RE = new RegExp(
  String.raw`\b((?:Defendant|Respondent|Opposite\s+Part(?:y|ies)|Vendor|Seller|defendant|respondent|opposite\s+part(?:y|ies)|vendor|seller))(?:\s+No\.?\s*\d+)?\s*:\s*(${LABELED_NAME})${LABEL_NAME_STOP}`,
  "gm",
)

/** Corporate / institutional suffixes for opposite-party org names. */
const ORG_SUFFIX_TOKEN =
  /^(?:Pvt\.?|Ltd\.?|LLP|Inc\.?|Corp\.?|Co\.?|Company|Limited|Private|Hospital|Hospitals|Clinic|Clinics|Insurance|Bank|Motors|Industries|Technologies|Services)$/i

/** "agreement to sell … between X and Y" / "between X and Y" civil narratives */
const BETWEEN_PARTIES_RE =
  /\bbetween\s+([A-Z][A-Za-z.']*(?:\s+[A-Z][A-Za-z.']*){0,3})\s+and\s+([A-Z][A-Za-z.']*(?:\s+[A-Z][A-Za-z.']*){0,3})\b/

const STATE_PARTY =
  /^(?:the\s+)?(?:state(?:\s+of\s+[A-Za-z][\sA-Za-z]*)?|union\s+of\s+india|govt\.?(?:\s+of\s+[A-Za-z\s]+)?|government(?:\s+of\s+[A-Za-z\s]+)?)$/i

/** Narrative verbs / words that must not appear in a person-name candidate. */
const NAME_NOISE =
  /\b(?:offered|refund|agreed|purchase|sold|paid|filed|seeks|alleges|contends|entered|executed|residing|aged|years|businessman|architect|wife|husband|property|advance|earnest|amount|rupees|lakhs)\b/i

export type ExtractedPlaintiffRole = "plaintiff" | "petitioner" | "complainant"
export type ExtractedDefendantRole = "defendant" | "respondent" | "opposite_party"
export type ExtractedPartyRole = ExtractedPlaintiffRole | ExtractedDefendantRole

export interface ExtractedPlaintiff {
  name: string
  role: ExtractedPlaintiffRole
}

export interface ExtractedDefendant {
  name: string
  role: ExtractedDefendantRole
}

/** @deprecated Prefer ExtractedPlaintiff / ExtractedDefendant for narrowed roles. */
export type ExtractedParty = ExtractedPlaintiff | ExtractedDefendant

export interface ExtractedParties {
  plaintiffs: ExtractedPlaintiff[]
  defendants: ExtractedDefendant[]
}

export interface DraftFieldHints {
  clientName?: string
  opposingParty?: string
  courtName?: string
  /** Structured multi-party extraction (preferred over joined strings when present). */
  parties?: ExtractedParties
}

export interface DraftFieldHintContext {
  documentKind?: string
  category?: string | null
}

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

const CAPTION_NOISE_SUFFIX =
  /\s+(?:maintenance|appeal|petition|revision|writ|bail|application|complaint|suit|case)(?:\b.*)?$/i

function cleanPartyCaptionName(value: string): string {
  let name = cleanName(value).replace(
    /\b(?:Jurisdiction|Date|Parties|Background|Incident)\b.*$/i,
    "",
  )
  while (CAPTION_NOISE_SUFFIX.test(name)) {
    name = name.replace(CAPTION_NOISE_SUFFIX, "")
  }
  // Strip trailing punctuation captured from "Name." line endings
  return name.replace(/[.,;:]+$/g, "").trim()
}

function titleCaseHonorificName(value: string): string {
  return cleanName(value).replace(/\b([a-z])/g, (c) => c.toUpperCase())
}

/** Reject garbage honorific/narrative captures. */
export function isPlausiblePersonName(name: string): boolean {
  const cleaned = cleanName(name)
  if (!cleaned || cleaned.length < 1 || cleaned.length > 80) return false
  if (NAME_NOISE.test(cleaned)) return false
  if (/\d{2,}/.test(cleaned)) return false
  // Must be honorific+name, State..., or 1–5 name-like tokens
  if (isStateParty(cleaned)) return true
  if (/^(?:Mrs?|Ms|Miss|Mr|Shri|Smt|Dr)\.?\s+/i.test(cleaned)) {
    const rest = cleaned.replace(/^(?:Mrs?|Ms|Miss|Mr|Shri|Smt|Dr)\.?\s+/i, "")
    return isPlausibleBareName(rest)
  }
  return isPlausibleBareName(cleaned)
}

function isPlausibleBareName(name: string): boolean {
  const tokens = name.split(/\s+/).filter(Boolean)
  if (tokens.length === 0 || tokens.length > 5) return false
  // Single/double initials: "K", "S", "R K"
  if (tokens.every((t) => /^[A-Za-z]\.?$/.test(t))) return true
  // Each token capitalized word or initial
  return tokens.every(
    (t) => /^[A-Z][a-zA-Z']+$/.test(t) || /^[A-Za-z]\.?$/.test(t),
  )
}

/** Accept hospital / insurer / company names rejected by person-name rules. */
export function isPlausibleOrganizationName(name: string): boolean {
  const cleaned = cleanPartyCaptionName(name)
  if (!cleaned || cleaned.length < 3 || cleaned.length > 120) return false
  if (NAME_NOISE.test(cleaned)) return false
  if (/\d{2,}/.test(cleaned)) return false
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  if (tokens.length < 2 || tokens.length > 8) return false
  const tokenOk = tokens.every(
    (t) =>
      ORG_SUFFIX_TOKEN.test(t) ||
      /^[A-Z][A-Za-z']*\.?$/.test(t) ||
      /^[A-Za-z]\.?$/.test(t),
  )
  if (!tokenOk) return false
  return tokens.some((t) => ORG_SUFFIX_TOKEN.test(t)) || tokens.length >= 2
}

function isPlausiblePartyName(name: string): boolean {
  return isPlausiblePersonName(name) || isPlausibleOrganizationName(name)
}

function isStateParty(name: string): boolean {
  return STATE_PARTY.test(cleanPartyCaptionName(name))
}

function isConsumerDocument(ctx?: DraftFieldHintContext, text?: string): boolean {
  const category = ctx?.category?.trim().toLowerCase()
  if (category === "consumer") return true
  const kind = (ctx?.documentKind ?? "").toLowerCase()
  if (/\bconsumer\b/.test(kind) || kind.includes("consumer")) return true
  // Research / strategy / document-production memos often sit on consumer facts.
  if (
    /research_memo|case_strategy|document_production|interim_application_document/i.test(
      kind,
    )
  ) {
    if (
      text &&
      /\bconsumer\s+complaint\b|\bcpa\b|\bconsumer\s+protection\b|\bdeficiency\s+(?:of|in)\s+service\b/i.test(
        text,
      )
    ) {
      return true
    }
  }
  if (category === "research" && text) {
    return /\bconsumer\s+complaint\b|\bcpa\b|\bconsumer\s+protection\b/i.test(text)
  }
  return false
}

/** Reject false-positive court values (e.g. SC matching "scan"). */
export function isPlausibleCourtName(value: string): boolean {
  const cleaned = cleanName(value)
  if (!cleaned || cleaned.length < 3 || cleaned.length > 120) return false
  if (/\bscan\b/i.test(cleaned)) return false
  if (/\bwas\s+performed\b/i.test(cleaned)) return false
  return true
}

function isDefenceCriminalDocument(
  text: string,
  ctx?: DraftFieldHintContext,
): boolean {
  const category = ctx?.category?.trim().toLowerCase()
  if (category === "bail" || category === "criminal") return true

  const kind = (ctx?.documentKind ?? "").toLowerCase()
  if (
    /bail|discharge|anticipatory|criminal|quash|ndps|pmla|pocso|custody|surety/i.test(
      kind,
    )
  ) {
    return true
  }

  return /\b(?:regular\s+bail|anticipatory\s+bail|seek(?:s|ing)?\s+bail|bail\s+application|applicant[-–]accused|accused\s+was\s+arrested|in\s+custody|chargesheet|discharge\s+application)\b/i.test(
    text,
  )
}

function inferStatePartyLabel(text: string): string {
  const explicit = text.match(/\bState\s+of\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\b/i)
  if (explicit?.[1]) {
    return `State of ${cleanName(explicit[1])}`
  }

  const regionState: Array<[RegExp, string]> = [
    [/Ahmedabad|Gujarat|Surat|Vadodara|Rajkot/i, "State of Gujarat"],
    [/Mumbai|Pune|Maharashtra|Nagpur/i, "State of Maharashtra"],
    [/Delhi|New Delhi|Noida|Gurugram/i, "State of NCT of Delhi"],
    [/Bengaluru|Bangalore|Karnataka/i, "State of Karnataka"],
    [/Chennai|Tamil Nadu/i, "State of Tamil Nadu"],
    [/Hyderabad|Telangana/i, "State of Telangana"],
    [/Kolkata|West Bengal/i, "State of West Bengal"],
    [/Jaipur|Rajasthan/i, "State of Rajasthan"],
    [/Lucknow|Uttar Pradesh/i, "State of Uttar Pradesh"],
    [/Chandigarh/i, "State of Punjab and Haryana"],
  ]

  for (const [pattern, label] of regionState) {
    if (pattern.test(text)) return label
  }

  return "State"
}

function applyDefenceCriminalParties(
  hints: DraftFieldHints,
  text: string,
  left: string,
  right: string,
): void {
  const leftName = cleanPartyCaptionName(left)
  const rightName = cleanPartyCaptionName(right)
  const stateLabel = inferStatePartyLabel(text)

  if (isStateParty(leftName)) {
    hints.clientName = hints.clientName ?? rightName
    hints.opposingParty = hints.opposingParty ?? stateLabel
    return
  }

  if (isStateParty(rightName)) {
    hints.clientName = hints.clientName ?? leftName
    hints.opposingParty = hints.opposingParty ?? stateLabel
  }
}

function applyLitigationParties(
  hints: DraftFieldHints,
  left: string,
  right: string,
): void {
  const leftName = cleanPartyCaptionName(left)
  const rightName = cleanPartyCaptionName(right)
  if (isPlausiblePersonName(leftName) || isStateParty(leftName)) {
    hints.clientName = hints.clientName ?? leftName
  }
  if (isPlausiblePersonName(rightName) || isStateParty(rightName)) {
    hints.opposingParty = hints.opposingParty ?? rightName
  }
}

function setClientIfPlausible(hints: DraftFieldHints, raw: string): void {
  const name = titleCaseHonorificName(raw)
  if (!isPlausiblePersonName(name)) return
  hints.clientName = hints.clientName ?? name
}

function setOpposingIfPlausible(hints: DraftFieldHints, raw: string): void {
  const name = titleCaseHonorificName(raw)
  if (!isPlausiblePersonName(name)) return
  hints.opposingParty = hints.opposingParty ?? name
}

function parseLabeledParties(text: string): ExtractedParties {
  const plaintiffs: ExtractedPlaintiff[] = []
  const defendants: ExtractedDefendant[] = []
  const seenP = new Set<string>()
  const seenD = new Set<string>()

  for (const m of text.matchAll(LABELED_PLAINTIFF_RE)) {
    const roleLabel = m[1].toLowerCase()
    const name = cleanPartyCaptionName(m[2])
    if (!name || !isPlausiblePartyName(name)) continue
    const key = name.toLowerCase()
    if (seenP.has(key)) continue
    seenP.add(key)
    plaintiffs.push({
      name,
      role:
        roleLabel.startsWith("complainant")
          ? "complainant"
          : roleLabel.startsWith("petitioner")
            ? "petitioner"
            : "plaintiff",
    })
  }

  for (const m of text.matchAll(LABELED_DEFENDANT_RE)) {
    const roleLabel = m[1].toLowerCase().replace(/\s+/g, " ")
    const name = cleanPartyCaptionName(m[2])
    if (!name || !isPlausiblePartyName(name)) continue
    const key = name.toLowerCase()
    if (seenD.has(key)) continue
    seenD.add(key)
    defendants.push({
      name,
      role:
        roleLabel.startsWith("opposite")
          ? "opposite_party"
          : roleLabel.startsWith("respondent")
            ? "respondent"
            : "defendant",
    })
  }

  return { plaintiffs, defendants }
}

function parseBetweenParties(text: string): ExtractedParties | null {
  const m = text.match(BETWEEN_PARTIES_RE)
  if (!m) return null
  const a = cleanPartyCaptionName(m[1])
  const b = cleanPartyCaptionName(m[2])
  if (!a || !b || !isPlausiblePersonName(a) || !isPlausiblePersonName(b)) return null
  // Prefer purchaser/plaintiff first when narrative mentions agreement to sell
  const sellContext = /agreement\s+to\s+sell|sale\s+deed|specific\s+performance/i.test(text)
  if (sellContext) {
    return {
      plaintiffs: [{ name: a, role: "plaintiff" }],
      defendants: [{ name: b, role: "defendant" }],
    }
  }
  return {
    plaintiffs: [{ name: a, role: "plaintiff" }],
    defendants: [{ name: b, role: "defendant" }],
  }
}

function joinPartyNames(
  parties: Array<{ name: string }>,
): string | undefined {
  if (parties.length === 0) return undefined
  return parties.map((p) => p.name).join("; ")
}

export function resolveDraftFieldHintContext(
  kind?: string,
  category?: string | null,
): DraftFieldHintContext {
  return { documentKind: kind, category }
}

export function extractDraftFieldHints(
  text: string,
  ctx?: DraftFieldHintContext,
): DraftFieldHints {
  const normalized = text.trim()
  if (!normalized) return {}

  const hints: DraftFieldHints = {}
  const defenceCriminal = isDefenceCriminalDocument(normalized, ctx)

  // 1) Labeled parties first (highest priority for civil plaints)
  const labeled = parseLabeledParties(normalized)
  if (labeled.plaintiffs.length > 0 || labeled.defendants.length > 0) {
    hints.parties = labeled
    const client = joinPartyNames(labeled.plaintiffs)
    const opposing = joinPartyNames(labeled.defendants)
    if (client) hints.clientName = client
    if (opposing) hints.opposingParty = opposing
  }

  // 1b) "between X and Y" civil narrative when no labels
  if (!hints.parties) {
    const between = parseBetweenParties(normalized)
    if (between) {
      hints.parties = between
      const client = joinPartyNames(between.plaintiffs)
      const opposing = joinPartyNames(between.defendants)
      if (client) hints.clientName = client
      if (opposing) hints.opposingParty = opposing
    }
  }

  const accusedBlock = normalized.match(ACCUSED_BLOCK)
  if (accusedBlock?.[1]) {
    hints.clientName = hints.clientName ?? cleanPartyCaptionName(accusedBlock[1])
  }

  const vsCaption = normalized.match(VS_CAPTION)
  if (vsCaption) {
    if (defenceCriminal) {
      applyDefenceCriminalParties(
        hints,
        normalized,
        vsCaption[1],
        vsCaption[2],
      )
    } else if (!hints.parties) {
      applyLitigationParties(hints, vsCaption[1], vsCaption[2])
    }
  }

  // Honorific narrative patterns — only fill gaps; never override labeled parties
  const complaintAgainst = normalized.match(
    new RegExp(
      `(${PERSON})\\s+wants?\\s+to\\s+file\\s+a\\s+complaint\\s+against\\s+(${PERSON})`,
    ),
  )
  if (complaintAgainst) {
    setClientIfPlausible(hints, complaintAgainst[1])
    setOpposingIfPlausible(hints, complaintAgainst[2])
  }

  const stalksMatch = normalized.match(
    new RegExp(`(${PERSON})\\s+stalks?\\s+(${PERSON})`),
  )
  if (stalksMatch) {
    setOpposingIfPlausible(hints, stalksMatch[1])
    setClientIfPlausible(hints, stalksMatch[2])
  }

  const vsHonorific = normalized.match(
    new RegExp(
      `(${PERSON})\\s+(?:vs\\.?|v\\.?|versus)\\s+(${PERSON})(?:\\s|,|\\.|\n|$)`,
    ),
  )
  if (vsHonorific) {
    if (defenceCriminal) {
      applyDefenceCriminalParties(
        hints,
        normalized,
        vsHonorific[1],
        vsHonorific[2],
      )
    } else if (!hints.parties) {
      setClientIfPlausible(hints, vsHonorific[1])
      setOpposingIfPlausible(hints, vsHonorific[2])
    }
  }

  const betweenMatch = normalized.match(
    new RegExp(
      `\\bbetween\\s+(${PERSON})\\s+and\\s+(${PERSON})(?:\\s|,|\\.|\n|$)`,
    ),
  )
  if (betweenMatch && !hints.parties) {
    setClientIfPlausible(hints, betweenMatch[1])
    setOpposingIfPlausible(hints, betweenMatch[2])
  }

  const agreementMatch = normalized.match(
    new RegExp(
      `(${PERSON})\\s+and\\s+(${PERSON})\\s+entered\\s+into\\s+(?:an\\s+)?(?:agreement|contract)`,
    ),
  )
  if (agreementMatch && !hints.parties) {
    setClientIfPlausible(hints, agreementMatch[1])
    setOpposingIfPlausible(hints, agreementMatch[2])
  }

  const purchaseMatch = normalized.match(
    new RegExp(
      `(${PERSON})\\s+agreed to (?:purchase|buy)[\\s\\S]{0,220}?\\bfrom\\s+(${PERSON})(?=\\s+(?:for|at|on|,|\\.|\\n|$))`,
    ),
  )
  if (purchaseMatch && !hints.parties) {
    setClientIfPlausible(hints, purchaseMatch[1])
    setOpposingIfPlausible(hints, purchaseMatch[2])
  }

  const ownerMatch = normalized.match(
    new RegExp(
      `(${PERSON})[\\s\\S]{0,120}?\\b(?:is|was)\\s+(?:the\\s+)?(?:owner|proprietor|vendor|seller|claimant|plaintiff)\\b`,
    ),
  )
  if (ownerMatch && !hints.parties) {
    setClientIfPlausible(hints, ownerMatch[1])
  }

  // Tight patterns only — a loose window before "agreed to purchase" wrongly
  // captured the earlier party in "X and Y entered… Y agreed to purchase".
  const purchaserMatch = normalized.match(
    new RegExp(
      `(${PERSON})\\s+(?:agreed to (?:purchase|buy)|is the (?:purchaser|buyer)|as (?:purchaser|buyer)|(?:purchaser|buyer|noticee))\\b`,
    ),
  )
  if (purchaserMatch && !hints.parties) {
    setOpposingIfPlausible(hints, purchaserMatch[1])
  }

  const soldToMatch = normalized.match(
    new RegExp(
      `\\bsold\\s+(?:the\\s+property\\s+)?(?:to|the\\s+property\\s+to)\\s+(${PERSON})`,
    ),
  )
  if (soldToMatch && !hints.parties) {
    setOpposingIfPlausible(hints, soldToMatch[1])
  }

  const noticeOnBehalfMatch = normalized.match(
    new RegExp(`\\bon\\s+behalf\\s+of\\s+(${PERSON})`),
  )
  if (noticeOnBehalfMatch && !hints.parties) {
    setClientIfPlausible(hints, noticeOnBehalfMatch[1])
  }

  const applicantMatch = normalized.match(
    new RegExp(
      `\\b(${PERSON})\\s+filed\\s+(?:a\\s+)?(?:petition|application|suit|complaint)`,
    ),
  )
  if (applicantMatch && !hints.parties) {
    setClientIfPlausible(hints, applicantMatch[1])
  }

  const marriedMatch = normalized.match(
    new RegExp(`\\b(${PERSON})\\s+and\\s+(${PERSON})\\s+were\\s+married`),
  )
  if (marriedMatch && !hints.parties) {
    setClientIfPlausible(hints, marriedMatch[1])
    setOpposingIfPlausible(hints, marriedMatch[2])
  }

  const seeksMatch = normalized.match(
    new RegExp(
      `\\b(${PERSON})\\s+seeks\\s+(?:remedy|relief|a\\s+(?:decree|order|divorce))`,
    ),
  )
  if (seeksMatch && !hints.parties) {
    setClientIfPlausible(hints, seeksMatch[1])
  }

  const allegesMatch = normalized.match(
    new RegExp(`\\b(${PERSON})\\s+alleges\\s+that`),
  )
  if (allegesMatch && !hints.parties) {
    setClientIfPlausible(hints, allegesMatch[1])
  }

  const contendsMatch = normalized.match(
    new RegExp(`\\b(${PERSON})\\s+contends\\s+that`),
  )
  if (contendsMatch && !hints.parties) {
    setOpposingIfPlausible(hints, contendsMatch[1])
  }

  const employerMatch = normalized.match(
    new RegExp(`\\b(${PERSON}),?\\s+(?:aged\\s+\\d+,?\\s+)?was employed`),
  )
  if (employerMatch && !hints.parties) {
    setClientIfPlausible(hints, employerMatch[1])
  }

  const opposedMatch = normalized.match(
    new RegExp(`\\b(${PERSON})\\s+opposed the application`),
  )
  if (opposedMatch && !hints.parties) {
    setOpposingIfPlausible(hints, opposedMatch[1])
  }

  // Only fill court when explicitly named — do not invent Sessions Court for sparse stalking.
  // Never match bare SC/HC — "CT scan" falsely matched SC and produced "scan was performed on 13".
  const consumerDoc = isConsumerDocument(ctx, normalized)
  const courtMatch = normalized.match(
    /\b((?:District Consumer Disputes Redressal Commission|State Consumer Disputes Redressal Commission|Consumer Forum|Consumer Commission|High Court|Supreme Court|Sessions Court|District Court|Family Court|Civil Court|Magistrate(?:'s)? Court|Police Station|NCDRC|NCLT|NCLAT|ITAT|CCI|DRAT|DRT)(?:[^\n,;.]{0,60})?)/i,
  )
  if (courtMatch && isPlausibleCourtName(courtMatch[1])) {
    hints.courtName = cleanName(courtMatch[1])
  } else if (
    consumerDoc ||
    !/\bstalk|\bcomplaint\s+against|\bfir\b/i.test(normalized)
  ) {
    const jurisdictionCityMatch = normalized.match(
      new RegExp(
        `(?:^|\\n)\\s*Jurisdiction\\s*:?\\s*(?:\\n\\s*)?(${INDIAN_CITIES})\\b`,
        "im",
      ),
    )
    const cityContextMatch = normalized.match(
      new RegExp(`\\b(?:in|at|before|(?:^|\\n)\\s*)(${INDIAN_CITIES})\\b`, "im"),
    )
    const cityOnlyMatch = normalized.match(new RegExp(`\\b(${INDIAN_CITIES})\\b`, "i"))
    const cityRaw =
      jurisdictionCityMatch?.[1] ?? cityContextMatch?.[1] ?? cityOnlyMatch?.[1]
    if (cityRaw) {
      const city = cleanName(cityRaw)
      if (/\bfamily court\b/i.test(normalized)) {
        hints.courtName = `Family Court, ${city}`
      } else if (consumerDoc) {
        hints.courtName = `District Consumer Disputes Redressal Commission, ${city}`
      } else if (defenceCriminal && /\bbail\b/i.test(normalized)) {
        hints.courtName = `Sessions Court, ${city}`
      } else if (
        /\bcivil suit|plaint|specific performance|agreement to sell\b/i.test(
          normalized,
        )
      ) {
        hints.courtName = `District Court, ${city}`
      } else {
        hints.courtName = `District Court, ${city}`
      }
    }
  }

  if (hints.courtName && !isPlausibleCourtName(hints.courtName)) {
    delete hints.courtName
  }

  return hints
}

/** Apply hints to empty fields only. */
export function applyDraftFieldHints(
  hints: DraftFieldHints,
  current: { clientName: string; opposingParty: string; courtName: string },
): { clientName: string; opposingParty: string; courtName: string } {
  const courtFromHints =
    hints.courtName && isPlausibleCourtName(hints.courtName) ? hints.courtName : ""
  const courtCurrent =
    current.courtName && isPlausibleCourtName(current.courtName) ? current.courtName : ""
  return {
    clientName: current.clientName || hints.clientName || "",
    opposingParty: current.opposingParty || hints.opposingParty || "",
    courtName: courtCurrent || courtFromHints || "",
  }
}
