import type { SectionFinderCountry } from './section-finder-config'

/** An unsupported scope stays unsupported; never substitute another country's law. */
export function resolveSectionFinderCountry(value?: string | null): SectionFinderCountry | null {
  const code = value?.trim().toUpperCase()
  return code && ['IN', 'US', 'GB', 'KE'].includes(code) ? code as SectionFinderCountry : null
}
