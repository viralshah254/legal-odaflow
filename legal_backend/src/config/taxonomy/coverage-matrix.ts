import {
  type PlatformDomain,
  type TaskPatternFeature,
  type Tier1Jurisdiction,
  PROFESSIONAL_DOMAINS,
  TIER1_JURISDICTIONS,
  featuresForJurisdiction,
} from './platform-taxonomy'

export type CoverageStatus = 'full' | 'partial' | 'missing'

export interface CoverageCell {
  domainSlug: string
  domainLabel: string
  jurisdiction: Tier1Jurisdiction
  feature: TaskPatternFeature
  status: CoverageStatus
  patternCount: number
}

export interface PatternCoverageInput {
  domainSlug?: string
  jurisdiction: Tier1Jurisdiction
  targetFeature: TaskPatternFeature
}

export function buildCoverageMatrix(
  patterns: PatternCoverageInput[],
): CoverageCell[] {
  const cells: CoverageCell[] = []

  for (const domain of PROFESSIONAL_DOMAINS) {
    for (const jurisdiction of TIER1_JURISDICTIONS) {
      if (!domain.jurisdictions.includes(jurisdiction)) continue

      for (const feature of featuresForJurisdiction(jurisdiction, domain.features)) {
        const matching = patterns.filter(
          (p) =>
            p.jurisdiction === jurisdiction &&
            p.targetFeature === feature &&
            p.domainSlug === domain.slug,
        )

        const count = matching.length
        let status: CoverageStatus = 'missing'
        if (count >= 1) status = 'full'
        else if (count === 0 && domain.statuteTags.length > 0) status = 'partial'

        cells.push({
          domainSlug: domain.slug,
          domainLabel: domain.label,
          jurisdiction,
          feature,
          status,
          patternCount: count,
        })
      }
    }
  }

  return cells
}

export function coverageSummary(cells: CoverageCell[]): {
  total: number
  full: number
  partial: number
  missing: number
  pctFull: number
} {
  const total = cells.length
  const full = cells.filter((c) => c.status === 'full').length
  const partial = cells.filter((c) => c.status === 'partial').length
  const missing = cells.filter((c) => c.status === 'missing').length
  return {
    total,
    full,
    partial,
    missing,
    pctFull: total > 0 ? Math.round((full / total) * 100) : 0,
  }
}

export function missingCells(cells: CoverageCell[]): CoverageCell[] {
  return cells.filter((c) => c.status === 'missing')
}

/** Minimum coverage gate for CI (--strict fails below threshold). */
export const COVERAGE_GATE_PCT = 80

export function passesCoverageGate(cells: CoverageCell[], minPct = COVERAGE_GATE_PCT): boolean {
  return coverageSummary(cells).pctFull >= minPct
}
