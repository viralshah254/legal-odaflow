import { getDraftFieldSchema } from "@/lib/drafting/draft-field-schemas"

export interface FormSampleInput {
  label: string
  kind: string
  formNumber?: string | null
  countryCode?: string | null
  authority?: string | null
  practiceArea?: string | null
  documentKind?: string | null
}

function isDomesticViolenceForm(input: FormSampleInput): boolean {
  const haystack = `${input.label} ${input.formNumber ?? ""}`.toLowerCase()
  return /domestic violence|harm|non.?molestation|molestation|c1a|fl401/i.test(haystack)
}

function isComplaintOrPetition(input: FormSampleInput): boolean {
  const haystack = `${input.label} ${input.kind}`.toLowerCase()
  return /complaint|petition|plaint|application|fir|bail|writ/i.test(haystack)
}

function isAgreement(input: FormSampleInput): boolean {
  const schema = getDraftFieldSchema(input.documentKind ?? input.kind)
  return schema.profile === "agreement"
}

function domesticViolenceSample(input: FormSampleInput): string {
  const formRef = input.formNumber ? ` (${input.formNumber})` : ""
  return `IN THE [COURT NAME]

${input.label.toUpperCase()}${formRef}

Applicant: [CLIENT NAME]
Respondent: [OPPOSING PARTY]

ALLEGATIONS OF HARM

1. The Applicant [CLIENT NAME] states that on or about [DATE OF INCIDENT], the Respondent [OPPOSING PARTY] [DESCRIBE CONDUCT — e.g. assaulted, threatened, or harassed the Applicant].

2. The Applicant further states that [ADDITIONAL FACTS — dates, witnesses, police involvement, medical treatment, children present, etc.].

3. The Applicant fears that without the court's protection, further harm may occur.

RELIEF SOUGHT

The Applicant respectfully requests that the court:
(a) note the allegations of harm set out above;
(b) make such orders as the court considers appropriate for the protection of the Applicant and any relevant children;
(c) grant such further or other relief as the court deems fit.

Verified at [PLACE] on [DATE].

[CLIENT NAME]
Applicant

---
Sample structure only — click Generate Draft to produce a complete AI-assisted filing from your facts.`
}

function litigationSample(input: FormSampleInput): string {
  return `IN THE [COURT NAME]
[CASE / COMPLAINT NO.: [CASE NUMBER]]

${input.label.toUpperCase()}${input.formNumber ? ` (${input.formNumber})` : ""}

BETWEEN:
[CLIENT NAME]                          ... Petitioner / Complainant
AND
[OPPOSING PARTY]                       ... Respondent / Accused

PARTIES
The Petitioner/Complainant is [CLIENT NAME], residing at [ADDRESS].
The Respondent is [OPPOSING PARTY], residing at [ADDRESS].

FACTS
1. [CHRONOLOGICAL FACT PARAGRAPH — what happened, when, and where.]
2. [LEGAL BASIS — statute, rule, or cause of action relied upon.]
3. [DETAILS OF LOSS, INJURY, OR BREACH.]

RELIEF SOUGHT
The Petitioner/Complainant prays that this Hon'ble Court may be pleased to:
(a) [PRIMARY RELIEF];
(b) [COSTS / INTEREST / INTERIM RELIEF AS APPLICABLE];
(c) grant such further relief as the court deems fit.

Place: [CITY]
Date: [DATE]

[CLIENT NAME]
Petitioner / Complainant

---
Sample structure only — click Generate Draft to produce a complete AI-assisted filing from your facts.`
}

function agreementSample(input: FormSampleInput): string {
  return `${input.label.toUpperCase()}
${input.formNumber ? `Reference: ${input.formNumber}` : ""}

This ${input.label} ("Agreement") is entered into on [DATE] by and between:

Party A: [CLIENT NAME] ("First Party")
Party B: [COUNTERPARTY NAME] ("Second Party")

1. PURPOSE
   [DESCRIBE THE BUSINESS PURPOSE AND SCOPE OF WORK OR ENGAGEMENT.]

2. TERM
   This Agreement commences on [START DATE] and continues until [END DATE / TERMINATION EVENT].

3. OBLIGATIONS
   (a) First Party shall [KEY OBLIGATIONS].
   (b) Second Party shall [KEY OBLIGATIONS].

4. FEES / CONSIDERATION
   [PAYMENT TERMS, AMOUNT, AND SCHEDULE.]

5. CONFIDENTIALITY
   [CONFIDENTIALITY / DATA PROTECTION CLAUSES AS NEEDED.]

6. GOVERNING LAW
   This Agreement is governed by the laws of [JURISDICTION].

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

_________________________          _________________________
[CLIENT NAME]                      [COUNTERPARTY NAME]

---
Sample structure only — click Generate Draft to produce a complete AI-assisted agreement from your details.`
}

function genericFormSample(input: FormSampleInput): string {
  const authority = input.authority ? `\nAuthority: ${input.authority}` : ""
  return `${input.label.toUpperCase()}${input.formNumber ? `\nForm No.: ${input.formNumber}` : ""}${authority}

Applicant / Filer: [CLIENT NAME]
${input.countryCode ? `Country: ${input.countryCode}` : ""}

SECTION 1 — FILING DETAILS
Court / Tribunal: [COURT NAME]
Case reference: [CASE NUMBER]
Date of filing: [DATE]

SECTION 2 — STATEMENT OF FACTS
[PROVIDE A CLEAR NARRATIVE OF THE RELEVANT FACTS, DATES, PARTIES, AND DOCUMENTS.]

SECTION 3 — GROUNDS / BASIS
[STATUTORY OR PROCEDURAL BASIS FOR THIS FILING.]

SECTION 4 — PRAYER / RELIEF SOUGHT
[SPECIFIC ORDERS OR OUTCOMES REQUESTED.]

Signature: [CLIENT NAME]
Date: [DATE]

---
Sample structure only — click Generate Draft to produce a complete AI-assisted form from your facts.`
}

export function buildFormSampleDraft(input: FormSampleInput): string {
  if (isDomesticViolenceForm(input)) return domesticViolenceSample(input)
  if (isAgreement(input)) return agreementSample(input)
  if (isComplaintOrPetition(input) || getDraftFieldSchema(input.documentKind ?? input.kind).profile === "litigation") {
    return litigationSample(input)
  }
  return genericFormSample(input)
}
