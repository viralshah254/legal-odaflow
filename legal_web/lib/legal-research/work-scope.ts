/** Explicitly starting unassigned work must detach any previous matter scope. */
export function resolveResearchMatterId(input: {
  selection?: { matterId?: string | null } | null
  requestedMatterId?: string | null
  contextMatterId?: string | null
}): string | undefined {
  if (input.selection != null) return input.selection.matterId || undefined
  return input.requestedMatterId || input.contextMatterId || undefined
}
