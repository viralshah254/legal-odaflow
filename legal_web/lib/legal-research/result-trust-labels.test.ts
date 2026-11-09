import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { ResearchResultsShell } from '@/components/research/research-results-shell'
import type { LegalResearchResponse } from '@/lib/api/types'
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key === 'modeVerified' ? 'Verified mode' : key }))
vi.mock('@/components/research/research-verification-card', () => ({ ResearchVerificationCard: () => null }))
vi.mock('@/components/research/similar-cases-panel', () => ({ SimilarCasesPanel: () => null }))
vi.mock('@/components/research/research-memo-answer', () => ({ ResearchMemoAnswer: () => null }))
function render(overrides: Partial<LegalResearchResponse> = {}) {
  const result = { answer: '', citations: [{ title: 'Candidate judgment', source: 'e-SCR', citation: 'SCR 123' }], mode: 'research', disclaimer: '', researchMode: 'DEEP', publicationState: 'VERIFICATION_UNAVAILABLE', ...overrides } as LegalResearchResponse
  return renderToStaticMarkup(React.createElement(ResearchResultsShell, { result, query: 'Employee notice', citations: result.citations, verificationCardProps: {} }))
}
it('does not claim verification or promote key authorities when the live source checks were unavailable', () => {
  const html = render()
  expect(html).toContain('Verified mode')
  expect(html).not.toContain('Verified research')
  expect(html).not.toContain('Key authorities')
  expect(html).toContain('Authorities (')
})
it('does not infer controlling precedent from agreement between citation checkers', () => {
  const html = render({ publicationState: 'RESEARCH_BACKED', citationAudit: { verifiedCitationCount: 1, unsupportedClaims: [], warnings: [], safeForReliance: true }, tripleCheck: { verifiedCount: 1, correctedCount: 0, unverifiedCount: 0, authorities: [{ raw: 'Candidate judgment SCR 123', state: 'verified', agreementCount: 3, checks: { corpus: true, connector: true, web: true } }] } })
  expect(html).toContain('Key authorities')
  expect(html).not.toContain('Controlling')
})
