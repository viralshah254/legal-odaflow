/** Fifteen-section consumer legal report structure (Transformation / Production Spec). */
export const LEGAL_REPORT_SECTIONS = [
  "Executive Summary",
  "Situation Summary",
  "Legal Issue Classification",
  "Jurisdiction Context",
  "Relevant Legal Principles",
  "Strengths",
  "Risks",
  "Evidence Needed",
  "Options",
  "Suggested Next Steps",
  "Questions to Ask a Lawyer",
  "Draft Letter",
  "Timeline & Deadlines",
  "Sources",
  "Disclaimer",
] as const

export type LegalReportSectionTitle = (typeof LEGAL_REPORT_SECTIONS)[number]

export interface ParsedReportSection {
  title: string
  content: string
  index: number
}

export interface FirmIntakeStructuredOutput {
  situation?: string
  legalIssues?: string[]
  strengths?: string[]
  risksAndGaps?: string[]
  recommendedNextSteps?: string[]
  sourcesCited?: string[]
}

/** Map alternate heading text to canonical section titles. */
const SECTION_TITLE_ALIASES: Record<string, LegalReportSectionTitle> = {
  "issue overview": "Situation Summary",
  "facts summary": "Situation Summary",
  "situation": "Situation Summary",
  "legal analysis": "Relevant Legal Principles",
  "applicable law": "Relevant Legal Principles",
  "applicable law overview": "Relevant Legal Principles",
  "relevant legal principles": "Relevant Legal Principles",
  "legal principles": "Relevant Legal Principles",
  "legal issue classification": "Legal Issue Classification",
  "legal issues": "Legal Issue Classification",
  "jurisdiction": "Jurisdiction Context",
  "jurisdiction context": "Jurisdiction Context",
  "weaknesses and risks": "Risks",
  "risks and evidence gaps": "Risks",
  "risks & gaps": "Risks",
  "risks and gaps": "Risks",
  "missing evidence to request": "Evidence Needed",
  "missing evidence": "Evidence Needed",
  "evidence needed": "Evidence Needed",
  "recommended next steps": "Suggested Next Steps",
  "recommended next steps for counsel": "Suggested Next Steps",
  "next steps": "Suggested Next Steps",
  "potential outcomes": "Options",
  "options": "Options",
  "questions for a lawyer": "Questions to Ask a Lawyer",
  "timeline considerations": "Timeline & Deadlines",
  "timeline & deadlines": "Timeline & Deadlines",
  "cost and time estimates": "Timeline & Deadlines",
  "sources cited": "Sources",
  "strengths for our client": "Strengths",
}

function normalizeTitle(title: string): string {
  return title
    .replace(/^#+\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\*+/g, "")
    .trim()
    .toLowerCase()
}

function resolveCanonicalTitle(rawTitle: string): LegalReportSectionTitle | null {
  const normalized = normalizeTitle(rawTitle)
  const direct = LEGAL_REPORT_SECTIONS.find(
    (t) => normalizeTitle(t) === normalized,
  )
  if (direct) return direct
  return SECTION_TITLE_ALIASES[normalized] ?? null
}

function extractStructuredFromMarkdown(
  markdown: string,
): FirmIntakeStructuredOutput | undefined {
  const match = markdown.match(/```json\s*([\s\S]*?)\s*```/i)
  if (!match?.[1]) return undefined
  try {
    return JSON.parse(match[1]) as FirmIntakeStructuredOutput
  } catch {
    return undefined
  }
}

function bullets(items: string[] | undefined): string {
  if (!items?.length) return ""
  return items.map((item) => `- ${item}`).join("\n")
}

function fillFromStructured(
  sections: ParsedReportSection[],
  structured: FirmIntakeStructuredOutput,
): ParsedReportSection[] {
  const byTitle = new Map(sections.map((s) => [s.title, s]))

  const setIfEmpty = (title: LegalReportSectionTitle, content: string) => {
    const section = byTitle.get(title)
    if (section && !section.content.trim() && content.trim()) {
      section.content = content
    }
  }

  setIfEmpty("Executive Summary", structured.situation ?? "")
  setIfEmpty("Situation Summary", structured.situation ?? "")
  setIfEmpty("Legal Issue Classification", bullets(structured.legalIssues))
  setIfEmpty("Strengths", bullets(structured.strengths))
  setIfEmpty("Risks", bullets(structured.risksAndGaps))
  setIfEmpty("Suggested Next Steps", bullets(structured.recommendedNextSteps))
  setIfEmpty("Sources", bullets(structured.sourcesCited))

  return sections
}

export function parseReportSections(markdown: string): ParsedReportSection[] {
  if (!markdown?.trim()) {
    return LEGAL_REPORT_SECTIONS.map((title, index) => ({
      title,
      content: "",
      index,
    }))
  }

  const parts = markdown.split(/^##\s+/m).filter(Boolean)
  const byTitle = new Map<LegalReportSectionTitle, string>()

  for (const part of parts) {
    const newline = part.indexOf("\n")
    const rawTitle = newline >= 0 ? part.slice(0, newline) : part
    const body = newline >= 0 ? part.slice(newline + 1).trim() : ""
    const canonical = resolveCanonicalTitle(rawTitle)
    if (canonical && body) {
      const existing = byTitle.get(canonical)
      byTitle.set(canonical, existing ? `${existing}\n\n${body}` : body)
    }
  }

  return LEGAL_REPORT_SECTIONS.map((title, index) => ({
    title,
    content: byTitle.get(title) ?? "",
    index,
  }))
}

export function countPopulatedSections(sections: ParsedReportSection[]): number {
  return sections.filter((s) => s.content.trim().length > 0).length
}

// ─── Per-Practice-Area Report Section Definitions ─────────────────────────────

export interface PracticeAreaReportConfig {
  practiceArea: string;
  additionalSections: string[];
  keySections: string[];
  aiPromptHint: string;
}

export const PRACTICE_AREA_REPORT_CONFIGS: Record<
  string,
  PracticeAreaReportConfig
> = {
  intellectual_property: {
    practiceArea: 'intellectual_property',
    additionalSections: [
      'IP Audit & Ownership Analysis',
      'Freedom-to-Operate Analysis',
      'Registration Strategy',
      'Enforcement Options',
      'Licensing Considerations',
      'International Filing Strategy',
    ],
    keySections: ['IP Audit & Ownership Analysis', 'Freedom-to-Operate Analysis', 'Registration Strategy'],
    aiPromptHint:
      'Focus on IP ownership, registrability, infringement risk, licensing opportunity, and multi-jurisdiction filing strategy.',
  },
  corporate_commercial: {
    practiceArea: 'corporate_commercial',
    additionalSections: [
      'Entity & Transaction Analysis',
      'Transaction Structure Options',
      'Key Legal Risks',
      'Due Diligence Checklist',
      'Regulatory Approvals Required',
      'Post-Completion Obligations',
    ],
    keySections: ['Entity & Transaction Analysis', 'Key Legal Risks', 'Due Diligence Checklist'],
    aiPromptHint:
      'Focus on corporate structure, transaction mechanics, regulatory compliance, director duties, and key deal risks.',
  },
  real_estate_property: {
    practiceArea: 'real_estate_property',
    additionalSections: [
      'Title Review & Search Results',
      'Conditions, Covenants & Encumbrances',
      'Stamp Duty & Registration Fees',
      'Completion Timeline & Key Dates',
      'Mortgage / Finance Considerations',
      'Registration Steps',
    ],
    keySections: ['Title Review & Search Results', 'Stamp Duty & Registration Fees', 'Completion Timeline & Key Dates'],
    aiPromptHint:
      'Focus on title status, encumbrances, stamp duty calculation, registration procedure, and completion logistics.',
  },
  tax: {
    practiceArea: 'tax',
    additionalSections: [
      'Tax Position Summary',
      'Applicable Rates & Thresholds',
      'Filing & Reporting Obligations',
      'Penalties & Interest Exposure',
      'Dispute / Appeal Options',
      'Tax Planning Recommendations',
    ],
    keySections: ['Tax Position Summary', 'Penalties & Interest Exposure', 'Dispute / Appeal Options'],
    aiPromptHint:
      'Focus on applicable tax law, liability calculation, compliance obligations, dispute procedures, and lawful mitigation strategies.',
  },
  wills_estates_probate: {
    practiceArea: 'wills_estates_probate',
    additionalSections: [
      'Estate Inventory & Valuation',
      'Applicable Succession Law',
      'Distribution Rules (Will / Intestacy)',
      'Probate Process & Timeline',
      'Inheritance / Estate Tax Exposure',
      'Administration Checklist',
    ],
    keySections: ['Estate Inventory & Valuation', 'Distribution Rules (Will / Intestacy)', 'Probate Process & Timeline'],
    aiPromptHint:
      'Focus on estate composition, applicable succession law, probate process, and tax exposure.',
  },
  employment_labour: {
    practiceArea: 'employment_labour',
    additionalSections: [
      'Employment Relationship Analysis',
      'Statutory Rights & Entitlements',
      'Tribunal / Court Process',
      'Compensation Calculation',
      'Settlement Options',
    ],
    keySections: ['Statutory Rights & Entitlements', 'Tribunal / Court Process', 'Compensation Calculation'],
    aiPromptHint:
      'Focus on employment contract terms, statutory rights, tribunal procedure, compensation quantum, and settlement considerations.',
  },
  family_matrimonial: {
    practiceArea: 'family_matrimonial',
    additionalSections: [
      'Matrimonial Status & Grounds',
      'Children & Custody Arrangements',
      'Financial Disclosure & Assets',
      'Maintenance Calculations',
      'Court Procedure',
    ],
    keySections: ['Children & Custody Arrangements', 'Financial Disclosure & Assets', 'Maintenance Calculations'],
    aiPromptHint:
      'Focus on marriage status, grounds for divorce, children arrangements, financial remedy, and welfare of children standard.',
  },
  criminal_defense: {
    practiceArea: 'criminal_defense',
    additionalSections: [
      'Charge & Offence Analysis',
      'Bail Options & Conditions',
      'Evidence & Disclosure',
      'Defense Strategy Options',
      'Sentencing Considerations',
      'Appeal Prospects',
    ],
    keySections: ['Charge & Offence Analysis', 'Defense Strategy Options', 'Bail Options & Conditions'],
    aiPromptHint:
      'Focus on elements of the offence, available defences, bail prospects, disclosure obligations, and sentencing guidelines.',
  },
  immigration: {
    practiceArea: 'immigration',
    additionalSections: [
      'Immigration Status Analysis',
      'Visa / Permit Category Assessment',
      'Eligibility & Requirements',
      'Application Process & Timeline',
      'Compliance & Conditions',
      'Appeals & Review Options',
    ],
    keySections: ['Visa / Permit Category Assessment', 'Eligibility & Requirements', 'Application Process & Timeline'],
    aiPromptHint:
      'Focus on current immigration status, most appropriate visa category, eligibility criteria, documentation required, and timeline.',
  },
  litigation_disputes: {
    practiceArea: 'litigation_disputes',
    additionalSections: [
      'Claim Analysis & Prospects',
      'Pre-Action Protocol',
      'Limitation Period Assessment',
      'Quantum / Damages Estimate',
      'ADR Options',
      'Enforcement Considerations',
    ],
    keySections: ['Claim Analysis & Prospects', 'Limitation Period Assessment', 'Quantum / Damages Estimate'],
    aiPromptHint:
      'Focus on cause of action, limitation, pre-action protocol compliance, quantum of damages, and realistic prospects of success.',
  },
}

export function getPracticeAreaReportConfig(practiceArea: string): PracticeAreaReportConfig | null {
  return PRACTICE_AREA_REPORT_CONFIGS[practiceArea] ?? null
}

export function getAllSectionsForPracticeArea(practiceArea: string): string[] {
  const base = [...LEGAL_REPORT_SECTIONS] as string[]
  const config = getPracticeAreaReportConfig(practiceArea)
  if (!config) return base
  const insertAt = base.indexOf('Timeline & Deadlines')
  const result = [...base]
  result.splice(insertAt >= 0 ? insertAt : result.length - 2, 0, ...config.additionalSections)
  return result
}

export function buildReportSectionsFromPreview(
  markdown: string,
  structuredOutput?: FirmIntakeStructuredOutput | null,
  caseMeta?: {
    issueType?: string
    countryCode?: string
    jurisdiction?: string
    facts?: string
  },
): ParsedReportSection[] {
  let sections = parseReportSections(markdown)
  const structured =
    structuredOutput ?? extractStructuredFromMarkdown(markdown)

  if (structured) {
    sections = fillFromStructured(sections, structured)
  }

  const populated = countPopulatedSections(sections)
  if (populated < 3) {
    const prose = markdown.replace(/```json\s*[\s\S]*?```/gi, "").trim()
    if (prose) {
      const exec = sections.find((s) => s.title === "Executive Summary")
      if (exec && !exec.content.trim()) {
        exec.content = prose.slice(0, 2000)
      }
      const principles = sections.find((s) => s.title === "Relevant Legal Principles")
      if (principles && !principles.content.trim() && prose.length > 2000) {
        principles.content = prose.slice(2000, 5000)
      }
    }
  }

  if (caseMeta) {
    const jurisdiction = sections.find((s) => s.title === "Jurisdiction Context")
    if (jurisdiction && !jurisdiction.content.trim()) {
      jurisdiction.content = [
        caseMeta.jurisdiction ? `Jurisdiction: ${caseMeta.jurisdiction}` : null,
        caseMeta.countryCode ? `Country: ${caseMeta.countryCode}` : null,
      ]
        .filter(Boolean)
        .join(". ")
    }
    const classification = sections.find(
      (s) => s.title === "Legal Issue Classification",
    )
    if (classification && !classification.content.trim() && caseMeta.issueType) {
      classification.content = `Issue type: ${caseMeta.issueType}.`
    }
    const situation = sections.find((s) => s.title === "Situation Summary")
    if (situation && !situation.content.trim() && caseMeta.facts) {
      situation.content = caseMeta.facts
    }
  }

  return sections
}
