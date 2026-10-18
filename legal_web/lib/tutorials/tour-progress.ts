import type { TutorialProgressMap } from "./types"

const storageKey = (userId: string) => `tutorial-progress-${userId}`

export function getCachedTutorialProgress(userId: string): TutorialProgressMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? (JSON.parse(raw) as TutorialProgressMap) : {}
  } catch {
    return {}
  }
}

export function setCachedTutorialProgress(
  userId: string,
  progress: TutorialProgressMap,
): void {
  if (typeof window === "undefined") return
  localStorage.setItem(storageKey(userId), JSON.stringify(progress))
}

export function mergeTutorialProgress(
  local: TutorialProgressMap,
  remote: TutorialProgressMap,
): TutorialProgressMap {
  const merged = { ...remote }
  for (const [id, entry] of Object.entries(local)) {
    const remoteEntry = remote[id]
    if (!remoteEntry) {
      merged[id] = entry
      continue
    }
    const localTime = entry.completedAt ? Date.parse(entry.completedAt) : 0
    const remoteTime = remoteEntry.completedAt
      ? Date.parse(remoteEntry.completedAt)
      : 0
    merged[id] = localTime >= remoteTime ? entry : remoteEntry
    if (entry.dismissedPanel || remoteEntry.dismissedPanel) {
      merged[id] = { ...merged[id], dismissedPanel: true }
    }
  }
  return merged
}
