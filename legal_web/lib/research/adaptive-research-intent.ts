import type { ResearchTaskKind } from "@/lib/api/types"

export type DesiredResearchOutput =
  | "ANSWER"
  | "AUTHORITY_LIST"
  | "ANALYSIS"
  | "MEMO"
  | "VERIFICATION"

export interface AdaptiveResearchPreview {
  taskKind: ResearchTaskKind
  label: string
  recipe: string
  targetCases: number
  targetSections: number
}

export function researchRecipeForTask(taskKind: ResearchTaskKind): string {
  switch (taskKind) {
    case "CASE_SURVEY":
      return "Up to 3 directly relevant judgments, plus governing provisions when material"
    case "CASE_COMPARISON":
      return "Named judgments, supported comparison fields, treatment and contrary authority"
    case "CASE_ANALYSIS":
    case "CASE_LOOKUP":
    case "CITATION_VERIFICATION":
      return "Exact authority identity, supported holding, source and verification gaps"
    case "SECTION_LOOKUP":
      return "Exact operative text and version, without unrelated case padding"
    case "STATUTORY_INTERPRETATION":
      return "Operative provisions first, plus up to 3 materially interpreting cases"
    case "PROCEDURE":
      return "Operative rules and sections first; cases only where interpretation requires"
    case "CURRENT_LAW":
    case "ADVERSE_AUTHORITY":
      return "Current provisions, binding authority, adverse authority and later treatment"
    case "MATTER_OPINION":
      return "Issue-specific provisions and authorities tied to the authorised matter facts"
    default:
      return "Governing provisions plus up to 3 leading or illustrative cases"
  }
}

export function inferAdaptiveResearchPreview(query: string): AdaptiveResearchPreview {
  const text = query.trim()
  const namedCase = /\b[A-Z][A-Za-z.&' -]{2,50}\s+(?:v\.?|versus)\s+[A-Z]/.test(text)
  const survey =
    /\b(?:similar|analogous|comparable|leading|relevant)\s+(?:cases?|judgments?|authorities)\b/i.test(text) ||
    /\b(?:cases?|judgments?|authorities)\b.*\b(?:outcomes?|holdings?|decisions?)\b/i.test(text) ||
    /\b(?:types?|examples?)\s+of\s+cases?\b/i.test(text)
  const sectionLookup =
    /\b(?:text|wording|quote|show|provide)\b.*\b(?:section|article|rule|regulation)\s+\d+/i.test(text)
  const statutoryInterpretation =
    /\b(?:interpret|meaning|scope|elements?|exception|apply)\b.*\b(?:section|article|act|code|rule)\b/i.test(text)
  const remedyOrTenancy =
    /\b(?:remed(?:y|ies)|landlord|tenant|lessee|lessor|vacate|evict)\b/i.test(text)
  const procedure =
    !remedyOrTenancy &&
    (/\b(?:procedure|procedural|filing|forum|how (?:do|to|can) (?:i|we)?\s*(?:file|appeal|challenge|apply)|next steps?)\b/i.test(
      text,
    ) ||
      /\b(?:service of (?:process|summons|notice)|notice of (?:motion|appeal|hearing))\b/i.test(text) ||
      (/\blimitation\b/i.test(text) && /\b(?:filing|suit|appeal|petition)\b/i.test(text)))
  const currentLaw = /\b(?:current|latest|in force|good law|overruled|repealed|superseded)\b/i.test(text)
  const citation = /\b(?:verify|correct|find)\b.*\b(?:citation|reporter|neutral citation)\b/i.test(text)
  const compare = namedCase && /\b(?:compare|versus|vs\.?|distinguish)\b/i.test(text)
  const structuredBrief =
    (text.match(/\b(?:case type|provision|law|court|stage|issue|offences?|accused|complainant)\s*:/gi)?.length ??
      0) >= 3 ||
    (/\bissue\s*:/i.test(text) &&
      /\b(?:section|article|§)\s*\d+/i.test(text) &&
      /\b(?:sessions|magistrate|high court|district|tribunal|commission)\b/i.test(text))

  if (survey) return {
    taskKind: "CASE_SURVEY",
    label: "Case survey",
    recipe: "Up to 3 directly relevant judgments, plus governing provisions when material",
    targetCases: 3,
    targetSections: 1,
  }
  if (compare) return {
    taskKind: "CASE_COMPARISON",
    label: "Named-case comparison",
    recipe: "Named judgments, supported comparison fields, treatment and contrary authority",
    targetCases: 3,
    targetSections: 1,
  }
  if (citation) return {
    taskKind: "CITATION_VERIFICATION",
    label: "Citation verification",
    recipe: "Exact authority identity, citation, source and supported holding",
    targetCases: 1,
    targetSections: 0,
  }
  if (sectionLookup) return {
    taskKind: "SECTION_LOOKUP",
    label: "Section lookup",
    recipe: "Exact operative text and version, without unrelated case padding",
    targetCases: 0,
    targetSections: 1,
  }
  if (structuredBrief) return {
    taskKind: "MATTER_OPINION",
    label: "Matter-specific opinion",
    recipe: "Issue-specific provisions and authorities tied to the authorised matter facts",
    targetCases: 2,
    targetSections: 3,
  }
  if (statutoryInterpretation) return {
    taskKind: "STATUTORY_INTERPRETATION",
    label: "Act or section analysis",
    recipe: "Operative provisions first, plus up to 3 materially interpreting cases",
    targetCases: 3,
    targetSections: 3,
  }
  if (procedure) return {
    taskKind: "PROCEDURE",
    label: "Procedure",
    recipe: "Operative rules and sections first; cases only where interpretation requires",
    targetCases: 1,
    targetSections: 3,
  }
  if (currentLaw) return {
    taskKind: "CURRENT_LAW",
    label: "Current law",
    recipe: "Current provisions, binding authority and later treatment",
    targetCases: 2,
    targetSections: 2,
  }
  return {
    taskKind: "GENERAL_RESEARCH",
    label: "Subject or doctrine research",
    recipe: "Governing provisions plus up to 3 leading or illustrative cases",
    targetCases: 3,
    targetSections: 2,
  }
}
