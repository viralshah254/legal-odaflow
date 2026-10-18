import type { LegalTaskPattern } from "@/lib/api/task-patterns"
import { recordTaskPatternUse } from "@/lib/api/task-patterns"

export interface LaunchTaskPatternOptions {
  tenantId?: string
  router: { push: (href: string) => void }
}

/** Navigate to the right feature with pattern prefill and record usage. */
export async function launchTaskPattern(
  pattern: LegalTaskPattern,
  { tenantId, router }: LaunchTaskPatternOptions,
): Promise<void> {
  void recordTaskPatternUse(pattern.id, {
    jurisdiction: pattern.jurisdiction,
    targetFeature: pattern.targetFeature,
    tenantId,
  }).catch(() => undefined)

  const cc = pattern.prefill.countryCode ?? pattern.jurisdiction
  const prefill = pattern.prefill

  switch (pattern.targetFeature) {
    case "research": {
      const q = prefill.query ?? pattern.body ?? pattern.description
      router.push(`/app/research?q=${encodeURIComponent(q)}&country=${cc}`)
      return
    }
    case "draft": {
      const params = new URLSearchParams()
      if (prefill.kind) params.set("kind", prefill.kind)
      if (prefill.label) params.set("label", prefill.label)
      if (prefill.details) params.set("details", prefill.details)
      if (pattern.domainSlug) params.set("practiceArea", pattern.domainSlug)
      const cc = prefill.countryCode ?? pattern.jurisdiction
      if (cc === "US") {
        router.push(`/app/us-drafting/draft?${params.toString()}`)
      } else if (cc === "IN") {
        router.push(`/app/india-drafting/draft?${params.toString()}`)
      } else {
        params.set("country", cc)
        router.push(`/app/legal-forms?${params.toString()}`)
      }
      return
    }
    case "review": {
      const params = new URLSearchParams()
      if (prefill.documentType) params.set("documentType", prefill.documentType)
      if (prefill.focusAreas?.length) params.set("focus", prefill.focusAreas.join(","))
      router.push(`/app/document-review?${params.toString()}`)
      return
    }
    case "intake": {
      const params = new URLSearchParams()
      if (prefill.brief) params.set("brief", prefill.brief)
      router.push(`/app/intake?${params.toString()}`)
      return
    }
    case "law_library": {
      const q =
        prefill.query ??
        (prefill.actId && prefill.section
          ? `${prefill.actId} section ${prefill.section}`
          : pattern.title)
      router.push(
        `/app/law-library?q=${encodeURIComponent(q)}&country=${cc}`,
      )
      return
    }
    case "section_finder": {
      const q =
        prefill.query ??
        (prefill.actId && prefill.section
          ? `${prefill.actId} ${prefill.section}`
          : pattern.title)
      router.push(
        `/app/section-finder?q=${encodeURIComponent(q)}&country=${cc}`,
      )
      return
    }
    case "copilot":
    default:
      router.push(`/app/research?q=${encodeURIComponent(pattern.body ?? pattern.description)}&country=${cc}`)
  }
}

const FAVORITES_KEY = "umbrella.task-pattern-favorites"

export function getFavoritePatternIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function toggleFavoritePattern(id: string): string[] {
  const current = getFavoritePatternIds()
  const next = current.includes(id)
    ? current.filter((x) => x !== id)
    : [...current, id]
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
  return next
}

export function isFavoritePattern(id: string): boolean {
  return getFavoritePatternIds().includes(id)
}
