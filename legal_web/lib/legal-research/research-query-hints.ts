export interface ResearchProgressStep {
  id?: string
  label: string
  detail?: string
  rotatingDetails?: string[]
}

export interface ResearchQueryHints {
  act?: string
  actFullName?: string
  section?: string
  isBareActQuery: boolean
}

export type ResearchProgressTranslator = (
  key: string,
  params?: Record<string, string | number | undefined>,
) => string

const ACT_PATTERNS: Array<{ re: RegExp; act: string; full: string }> = [
  { re: /\bbnss\b/i, act: "BNSS", full: "Bharatiya Nagarik Suraksha Sanhita (BNSS)" },
  { re: /\bbns\b/i, act: "BNS", full: "Bharatiya Nyaya Sanhita (BNS)" },
  { re: /\bbsa\b/i, act: "BSA", full: "Bharatiya Sakshya Adhiniyam (BSA)" },
  { re: /\b(?:crpc|cr\.?\s*pc)\b/i, act: "CrPC", full: "Code of Criminal Procedure (CrPC)" },
  { re: /\b(?:cpc|c\.?\s*pc)\b/i, act: "CPC", full: "Code of Civil Procedure (CPC)" },
  { re: /\bipc\b/i, act: "IPC", full: "Indian Penal Code (IPC)" },
  { re: /\biea\b/i, act: "IEA", full: "Indian Evidence Act (IEA)" },
  { re: /\b(?:ni act|negotiable instruments)\b/i, act: "NI Act", full: "Negotiable Instruments Act" },
  { re: /\b(?:u\.?\s*s\.?\s*c|usc)\b/i, act: "USC", full: "United States Code" },
  { re: /\bfrcp\b/i, act: "FRCP", full: "Federal Rules of Civil Procedure" },
]

function extractSection(query: string): string | undefined {
  const explicit = query.match(
    /\b(?:section|sec\.?|s\.?|§|rule)\s*(\d+[A-Za-z]?)/i,
  )
  if (explicit?.[1]) return explicit[1]

  const actThenNumber = query.match(
    /\b(?:bnss|bns|bsa|crpc|cpc|ipc|iea|usc|frcp)\s*(\d+[A-Za-z]?)\b/i,
  )
  if (actThenNumber?.[1]) return actThenNumber[1]

  return undefined
}

export function parseResearchQueryHints(query: string): ResearchQueryHints {
  const trimmed = query.trim()
  const lower = trimmed.toLowerCase()

  let act: string | undefined
  let actFullName: string | undefined
  for (const pattern of ACT_PATTERNS) {
    if (pattern.re.test(trimmed)) {
      act = pattern.act
      actFullName = pattern.full
      break
    }
  }

  const section = extractSection(trimmed)
  const isBareActQuery =
    Boolean(act && section) ||
    /\b(?:section|sec\.?|s\.?|§)\s*\d+/i.test(trimmed) ||
    /\bwhat is\b/i.test(lower)

  return { act, actFullName, section, isBareActQuery }
}

function researchStepContext(
  query: string,
  countryCode: string,
  t: ResearchProgressTranslator,
) {
  const provisionHints = parseResearchQueryHints(query)
  const provision =
    provisionHints.act && provisionHints.section
      ? `${provisionHints.act} Section ${provisionHints.section}`
      : provisionHints.section
        ? `Section ${provisionHints.section}`
        : provisionHints.act
          ? provisionHints.act
          : undefined
  const normalizedCountry = countryCode?.toUpperCase() ?? "IN"
  const corpusDetail =
    normalizedCountry === "US"
      ? t("stepCorpusDetailUs")
      : normalizedCountry === "IN"
        ? provisionHints.actFullName
          ? t("stepCorpusDetailInAct", { act: provisionHints.actFullName })
          : t("stepCorpusDetailIn")
        : t("stepCorpusDetailGeneric")
  const retrieveRotating = provision
    ? [
        t("stepRetrieveFetch", { provision }),
        t("stepRetrieveRank"),
        t("stepRetrieveCases"),
      ]
    : [t("stepRetrieveRankCases"), t("stepRetrieveMatch"), t("stepRetrieveCommentary")]
  const predecessorDetail =
    provisionHints.act === "BNSS" || provisionHints.act === "CrPC"
      ? provisionHints.section
        ? t("stepPredecessorCrpcBnssSection", { section: provisionHints.section })
        : t("stepPredecessorCrpcBnss")
      : t("stepPredecessorGeneric")
  const groundingRotating = provision
    ? [
        t("stepGroundPinProvision", { provision }),
        t("stepGroundVerify"),
        t("stepGroundAmendments"),
      ]
    : [t("stepGroundPin"), t("stepGroundCitations")]
  const draftRotating = [t("stepDraftStructure"), t("stepDraftWeave"), t("stepDraftSummary")]
  return {
    predecessorDetail,
    groundingRotating,
    parseStep: {
      id: "parse",
      label: t("stepParseLabel"),
      detail: provision ? t("stepParseDetailProvision", { provision }) : t("stepParseDetail"),
    } satisfies ResearchProgressStep,
    corpusStep: {
      id: "corpus",
      label: t("stepCorpusLabel"),
      detail: corpusDetail,
    } satisfies ResearchProgressStep,
    retrieveStep: {
      id: "retrieve",
      label: t("stepRetrieveLabel"),
      detail: retrieveRotating[0],
      rotatingDetails: retrieveRotating,
    } satisfies ResearchProgressStep,
    draftStep: {
      id: "draft",
      label: t("stepDraftLabel"),
      detail: draftRotating[0],
      rotatingDetails: draftRotating,
    } satisfies ResearchProgressStep,
    finalizeStep: {
      id: "finalize",
      label: t("stepFinalizeLabel"),
      detail: t("stepFinalizeDrift"),
      rotatingDetails: [t("stepFinalizeDrift"), t("stepFinalizePreview"), t("stepFinalizeReady")],
    } satisfies ResearchProgressStep,
  }
}

export function buildGuidanceResearchSteps(
  query: string,
  countryCode: string,
  t: ResearchProgressTranslator,
): ResearchProgressStep[] {
  const { parseStep, draftStep } = researchStepContext(query, countryCode, t)
  return [
    {
      id: parseStep.id,
      label: t("stepGuidanceReadLabel"),
      detail: t("stepGuidanceReadDetail"),
    },
    {
      id: draftStep.id,
      label: t("stepGuidanceDraftLabel"),
      detail: t("stepGuidanceDraftDetail"),
    },
    {
      id: "ready",
      label: t("stepGuidanceReadyLabel"),
      detail: t("stepGuidanceReadyDetail"),
    },
  ]
}

export function buildFastResearchSteps(
  query: string,
  countryCode: string,
  t: ResearchProgressTranslator,
): ResearchProgressStep[] {
  return buildGuidanceResearchSteps(query, countryCode, t)
}

export function buildDeepResearchSteps(
  query: string,
  countryCode: string,
  t: ResearchProgressTranslator,
) {
  const { parseStep, retrieveStep, draftStep } = researchStepContext(query, countryCode, t)
  return [
    parseStep,
    retrieveStep,
    draftStep,
    {
      id: "selfcheck",
      label: t("stepSelfCheckLabel"),
      detail: t("stepSelfCheckDetail"),
    },
    { id: "finalize", label: t("stepFinalizeLabel"), detail: t("stepGuidanceReadyDetail") },
    { id: "ready", label: t("stepGuidanceReadyLabel"), detail: t("stepGuidanceReadyDetail") },
  ]
}
