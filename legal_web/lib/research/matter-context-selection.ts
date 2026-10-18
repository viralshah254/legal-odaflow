export function toggleResearchContextId(
  selectedIds: string[],
  id: string,
  included: boolean,
): string[] {
  if (included) return selectedIds.includes(id) ? selectedIds : [...selectedIds, id]
  return selectedIds.filter((selectedId) => selectedId !== id)
}

export function describeResearchContextSelection(
  documentCount: number,
  savedResearchCount: number,
): string {
  if (documentCount === 0 && savedResearchCount === 0) {
    return "Matter profile and graph only; no document or prior-research text will be used."
  }
  return [
    documentCount ? `${documentCount} document${documentCount === 1 ? "" : "s"}` : "",
    savedResearchCount
      ? `${savedResearchCount} prior research item${savedResearchCount === 1 ? "" : "s"}`
      : "",
  ].filter(Boolean).join(" and ") + " will be used with the matter profile."
}
