/** Mirrors legal_backend legal-evidence-pack.service evidenceId derivation. */
export function evidenceIdFromAuthorityId(authorityId: string): string {
  return `EVD_${authorityId.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase().slice(0, 20)}`
}

export function buildEvidenceCitationMap(
  citations: Array<{ authorityId?: string; citation?: string; title: string }>,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const citation of citations) {
    if (!citation.authorityId) continue
    const label = (citation.citation ?? citation.title).trim()
    if (!label) continue
    const baseId = evidenceIdFromAuthorityId(citation.authorityId)
    map.set(baseId, label)
    map.set(`${baseId}_P1`, label)
  }
  return map
}

/** Resolve a legal-framework evidenceId to the same citation string the backend memo uses. */
export function resolveEvidenceCitationLabel(
  evidenceId: string,
  map: Map<string, string>,
): string | undefined {
  const direct = map.get(evidenceId)
  if (direct) return direct

  const withoutPassage = evidenceId.replace(/_P\d+$/, "")
  const fromPassage = map.get(withoutPassage)
  if (fromPassage) return fromPassage

  for (const [key, label] of map.entries()) {
    if (evidenceId.startsWith(key) || key.startsWith(withoutPassage)) return label
  }
  return undefined
}

export function citationIndexesForEvidenceIds(
  evidenceIds: string[],
  citations: Array<{ authorityId?: string }>,
): number[] {
  const normalizedTargets = new Set(
    evidenceIds.flatMap((id) => {
      const base = id.replace(/_P\d+$/, "")
      return [id.toLowerCase(), base.toLowerCase()]
    }),
  )

  return citations.flatMap((citation, index) => {
    if (!citation.authorityId) return []
    const baseId = evidenceIdFromAuthorityId(citation.authorityId).toLowerCase()
    const matches = normalizedTargets.has(baseId) ||
      normalizedTargets.has(`${baseId}_p1`) ||
      [...normalizedTargets].some(
        (target) => target.startsWith(baseId) || baseId.startsWith(target.replace(/_p\d+$/, "")),
      )
    return matches ? [index + 1] : []
  })
}

export function findCitationForEvidenceId<T extends { authorityId?: string }>(
  evidenceId: string,
  citations: T[],
): T | undefined {
  const baseTarget = evidenceId.replace(/_P\d+$/, "").toLowerCase()
  return citations.find((citation) => {
    if (!citation.authorityId) return false
    const baseId = evidenceIdFromAuthorityId(citation.authorityId).toLowerCase()
    return (
      evidenceId.toLowerCase() === baseId ||
      evidenceId.toLowerCase() === `${baseId}_p1` ||
      baseTarget === baseId ||
      evidenceId.toLowerCase().startsWith(baseId)
    )
  })
}
