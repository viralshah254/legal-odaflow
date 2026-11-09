import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FirmKnowledgePage from '@/app/app/firm-knowledge/page'

const state = vi.hoisted(() => ({ tenant: 'firm-a', canSubmit: false, detail: null as any }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/lib/contexts/tenant-context', () => ({ useTenant: () => ({ activeTenantId: state.tenant }) }))
vi.mock('@/lib/contexts/auth-context', () => ({ useAuth: () => ({ user: { id: 'maker' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/lib/hooks/use-api-data', () => ({ useApiData: (key: string[]) => ({
  data: key[0] === 'firm-knowledge' ? { items: [], count: 0, limit: 100, canSubmit: state.canSubmit, canReview: true, independentReviewRequired: true }
    : key[0] === 'firm-knowledge-detail' ? state.detail : key[0] === 'knowledge-matters' ? [] : undefined,
  refetch: vi.fn(), isFetching: false,
}) }))

describe('firm knowledge review UI privacy', () => {
  beforeEach(() => { state.canSubmit = false; state.detail = null })
  it('keeps submission disabled when the server denies permission', () => {
    const html = renderToStaticMarkup(React.createElement(FirmKnowledgePage))
    expect(html).toContain('knowledge_read_only')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>knowledge_submit/)
  })
  it('never displays a cached detail from another firm', () => {
    state.detail = { tenantId: 'firm-b', content: 'PRIVATE OTHER FIRM CONTENT' }
    const html = renderToStaticMarkup(React.createElement(FirmKnowledgePage))
    expect(html).not.toContain('PRIVATE OTHER FIRM CONTENT')
  })
  it('does not offer maker self approval inside a multi-person firm', () => {
    state.detail = { id: 'item', tenantId: 'firm-a', title: 'Memo', content: 'Fictional memo', status: 'PENDING',
      revision: 1, lastEditedById: 'maker', createdById: 'maker', matterId: 'matter', reviews: [] }
    const html = renderToStaticMarkup(React.createElement(FirmKnowledgePage))
    expect(html).toContain('knowledge_independent_review')
    expect(html).not.toContain('knowledge_self_review_confirm')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>knowledge_approve/)
  })
})
