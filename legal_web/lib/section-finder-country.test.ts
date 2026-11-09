import { describe, expect, it } from 'vitest'
import { resolveSectionFinderCountry } from './section-finder-country'

describe('Section Finder legal country', () => {
  it.each(['UG', 'FR', 'ZZ', '', undefined, null])('never falls back to India for %s', (country) => {
    expect(resolveSectionFinderCountry(country)).toBeNull()
  })
  it('preserves an explicitly supported country and normalizes case', () => {
    expect(resolveSectionFinderCountry('ke')).toBe('KE')
    expect(resolveSectionFinderCountry('US')).toBe('US')
  })
})
