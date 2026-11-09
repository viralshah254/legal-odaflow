import { expect, it } from 'vitest'
import { resolveResearchMatterId } from './work-scope'
it('unassigned work detaches both the URL and previous shared matter', () => {
  expect(resolveResearchMatterId({ selection: {}, requestedMatterId: 'old-url', contextMatterId: 'old-context' })).toBeUndefined()
})
it('an explicit matter link overrides a previously active matter', () => {
  expect(resolveResearchMatterId({ requestedMatterId: 'new-matter', contextMatterId: 'old-context' })).toBe('new-matter')
})
it('retains canonical matter context across drafting and research navigation', () => {
  expect(resolveResearchMatterId({ contextMatterId: 'active-matter' })).toBe('active-matter')
})
