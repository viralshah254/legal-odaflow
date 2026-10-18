import type {
  LegalResearchPracticalStep,
  LegalResearchPracticalStepTiming,
  LegalResearchUnansweredQuestion,
} from "@/lib/api/types"

export type PracticalStepGroup =
  | "NOW"
  | "BEFORE_FILING_OR_ADVISING"
  | "IF_FACTS_SUPPORT"

export interface NormalizedPracticalStep {
  original: LegalResearchPracticalStep
  index: number
  text: string
  timing: PracticalStepGroup
  purpose?: string
  evidence: string[]
  dependencies: string[]
}

export interface NormalizedUnansweredQuestion {
  original: LegalResearchUnansweredQuestion
  index: number
  text: string
  id?: string
  whyItMatters: string
}

export const defaultWhyQuestionMatters =
  "Resolving this question may change the analysis or recommended next steps."

export function practicalStepTiming(
  timing?: LegalResearchPracticalStepTiming,
): PracticalStepGroup {
  if (timing === "BEFORE_FILING_OR_ADVISING" || timing === "Before filing or advising") {
    return "BEFORE_FILING_OR_ADVISING"
  }
  if (
    timing === "IF_FACTS_SUPPORT" ||
    timing === "IF_FACTS_SUPPORT_IT" ||
    timing === "If facts support it"
  ) {
    return "IF_FACTS_SUPPORT"
  }
  return "NOW"
}

function asTrimmedText(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim()
  if (value && typeof value === "object" && "text" in value) {
    return asTrimmedText((value as { text?: unknown }).text)
  }
  return ""
}

function values(value?: unknown): string[] {
  if (!value) return []
  return (Array.isArray(value) ? value : [value])
    .map((item) => asTrimmedText(item))
    .filter(Boolean)
}

export function normalizePracticalSteps(
  steps: LegalResearchPracticalStep[],
): NormalizedPracticalStep[] {
  return steps.flatMap((step, index) => {
    const text = typeof step === "string"
      ? asTrimmedText(step)
      : asTrimmedText(step.action ?? step.step)
    if (!text) return []

    return [{
      original: step,
      index,
      text,
      timing: typeof step === "string"
        ? "NOW" as const
        : practicalStepTiming(step.timing ?? step.stage),
      purpose: typeof step === "string" ? undefined : asTrimmedText(step.purpose) || undefined,
      evidence: typeof step === "string" ? [] : values(step.evidence ?? step.evidenceNeeded),
      dependencies: typeof step === "string" ? [] : values(step.dependencies),
    }]
  })
}

export function normalizeUnansweredQuestions(
  questions: LegalResearchUnansweredQuestion[],
): NormalizedUnansweredQuestion[] {
  return questions.flatMap((question, index) => {
    const text = typeof question === "string"
      ? asTrimmedText(question)
      : asTrimmedText(question.question ?? question.text)
    if (!text) return []

    return [{
      original: question,
      index,
      text,
      id: typeof question === "string" ? undefined : question.id,
      whyItMatters: typeof question === "string"
        ? defaultWhyQuestionMatters
        : asTrimmedText(question.whyItMatters) || defaultWhyQuestionMatters,
    }]
  })
}

export function questionAction(
  callback: ((question: LegalResearchUnansweredQuestion, index: number) => void) | undefined,
  question: LegalResearchUnansweredQuestion,
  index: number,
): () => void {
  return () => callback?.(question, index)
}
