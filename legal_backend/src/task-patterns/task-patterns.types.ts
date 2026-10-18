export type TaskPatternFeature =
  | 'research'
  | 'draft'
  | 'review'
  | 'intake'
  | 'copilot'
  | 'law_library'
  | 'section_finder'

export type TaskPatternScope = 'system' | 'firm' | 'user'

export interface StatuteRef {
  countryCode: string
  actId: string
  section?: string
}

export interface TaskPatternPrefill {
  query?: string
  countryCode?: string
  kind?: string
  label?: string
  details?: string
  documentType?: string
  focusAreas?: string[]
  brief?: string
  actId?: string
  section?: string
}

export interface LegalTaskPattern {
  id: string
  slug: string
  title: string
  description: string
  /** Prompt / task text; defaults to description when omitted in catalog entries. */
  body?: string
  targetFeature: TaskPatternFeature
  jurisdiction: 'IN' | 'US' | 'KE' | 'GB'
  practiceAreas: string[]
  tags: string[]
  statuteRefs?: StatuteRef[]
  prefill: TaskPatternPrefill
  scope: TaskPatternScope
  sortOrder: number
  /** Canonical platform domain slug from shared taxonomy */
  domainSlug?: string
}

export interface ListTaskPatternsQuery {
  jurisdiction?: string
  targetFeature?: TaskPatternFeature
  practiceArea?: string
  q?: string
}

export interface TaskPatternUsageEvent {
  patternId: string
  targetFeature: TaskPatternFeature
  jurisdiction: string
  tenantId?: string
  userId?: string
}
