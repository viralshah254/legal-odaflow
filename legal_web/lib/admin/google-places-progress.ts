import type { GooglePlacesScrapeProgress, ProspectImportRun } from "@/lib/api/admin"

/** DB checkpoint batch size (matches backend discovery.config.ts). */
export const GOOGLE_PLACES_BATCH_SIZE = 50
/** Full mode: 2 text searches + 2×2 grid = 6 steps. */
export const GOOGLE_PLACES_DISCOVERY_STEP_TOTAL = 6
export const GOOGLE_PLACES_ENRICHMENT_STEP_TOTAL = 2

export function parseGooglePlacesProgress(raw: unknown): GooglePlacesScrapeProgress | null {
  if (!raw || typeof raw !== "object") return null
  const data = raw as Partial<GooglePlacesScrapeProgress>
  if (!Array.isArray(data.placeIds)) return null
  const mode = data.scrapeMode === "enrichment" ? "enrichment" : "full"
  const defaultSteps =
    mode === "enrichment" ? GOOGLE_PLACES_ENRICHMENT_STEP_TOTAL : GOOGLE_PLACES_DISCOVERY_STEP_TOTAL
  return {
    batchSize: data.batchSize ?? GOOGLE_PLACES_BATCH_SIZE,
    placeIds: data.placeIds.filter((id): id is string => typeof id === "string"),
    completedBatchIndexes: Array.isArray(data.completedBatchIndexes)
      ? data.completedBatchIndexes.filter((n): n is number => typeof n === "number")
      : [],
    discoveryCompletedAt:
      typeof data.discoveryCompletedAt === "string" ? data.discoveryCompletedAt : undefined,
    discoveryStep: typeof data.discoveryStep === "number" ? data.discoveryStep : undefined,
    discoveryStepTotal:
      typeof data.discoveryStepTotal === "number" ? data.discoveryStepTotal : defaultSteps,
    discoveryStepLabel:
      typeof data.discoveryStepLabel === "string" ? data.discoveryStepLabel : undefined,
    lastProgressAt: typeof data.lastProgressAt === "string" ? data.lastProgressAt : undefined,
    cancelRequestedAt:
      typeof data.cancelRequestedAt === "string" ? data.cancelRequestedAt : undefined,
    scrapeMode: mode,
    apiVersion: data.apiVersion === "legacy" ? "legacy" : "new",
    prospectCache: data.prospectCache,
  }
}

export interface GooglePlacesScrapeDisplay {
  locationLabel: string
  phase: "discovery" | "details" | "done"
  phaseLabel: string
  percent: number
  placeCount: number
  doneBatches: number
  totalBatches: number
  firmsProcessed: number
  insertedCount: number
  updatedCount: number
  discoveryStep: number
  discoveryStepTotal: number
  elapsedLabel: string
  lastActivityLabel: string
  isStale: boolean
  scrapeMode: "full" | "enrichment"
  apiVersion: "new" | "legacy"
}

export function formatGooglePlacesLocation(sourceSummary: string | null | undefined): string {
  const parts = sourceSummary?.split(":") ?? []
  if (parts.length >= 4) return `${parts[3]}, ${parts[2]}, ${parts[1]}`
  if (parts.length >= 2) return parts[parts.length - 1] ?? ""
  return ""
}

export function formatElapsedSince(iso: string | undefined): string {
  if (!iso) return ""
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return "just now"
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ${sec % 60}s`
  const hr = Math.floor(min / 60)
  return `${hr}h ${min % 60}m`
}

export function getGooglePlacesScrapeDisplay(
  run: Pick<
    ProspectImportRun,
    "sourceSummary" | "progressJson" | "insertedCount" | "updatedCount" | "status" | "startedAt"
  >,
  fallbackLocation?: string,
): GooglePlacesScrapeDisplay {
  const progress = parseGooglePlacesProgress(run.progressJson)
  const batchSize = progress?.batchSize ?? GOOGLE_PLACES_BATCH_SIZE
  const placeCount = progress?.placeIds.length ?? 0
  const doneBatches = progress?.completedBatchIndexes.length ?? 0
  const totalBatches = placeCount > 0 ? Math.ceil(placeCount / batchSize) : 0
  const firmsProcessed = Math.min(doneBatches * batchSize, placeCount)
  const scrapeMode = progress?.scrapeMode ?? "full"
  const apiVersion = progress?.apiVersion ?? "new"
  const discoveryStepTotal =
    progress?.discoveryStepTotal ??
    (scrapeMode === "enrichment" ? GOOGLE_PLACES_ENRICHMENT_STEP_TOTAL : GOOGLE_PLACES_DISCOVERY_STEP_TOTAL)
  const discoveryStep = progress?.discoveryStep ?? 0
  const locationLabel =
    formatGooglePlacesLocation(run.sourceSummary) || fallbackLocation || "selected city"
  const elapsedLabel = formatElapsedSince(run.startedAt)
  const lastActivityAt = progress?.lastProgressAt ?? run.startedAt
  const lastActivityLabel = formatElapsedSince(lastActivityAt)
  const isStale = Date.now() - new Date(lastActivityAt).getTime() > 3 * 60 * 1000

  if (run.status === "COMPLETED") {
    return {
      locationLabel,
      phase: "done",
      phaseLabel: "Import complete",
      percent: 100,
      placeCount,
      doneBatches: totalBatches,
      totalBatches,
      firmsProcessed: placeCount,
      insertedCount: run.insertedCount,
      updatedCount: run.updatedCount,
      discoveryStep: discoveryStepTotal,
      discoveryStepTotal,
      elapsedLabel,
      lastActivityLabel,
      isStale: false,
      scrapeMode,
      apiVersion,
    }
  }

  if (!progress?.discoveryCompletedAt) {
    const stepPercent =
      discoveryStep > 0
        ? Math.round((discoveryStep / discoveryStepTotal) * 10)
        : 2
    const label =
      progress?.discoveryStepLabel ??
      `Discovering law firms (${apiVersion} API, step ${discoveryStep}/${discoveryStepTotal})…`

    return {
      locationLabel,
      phase: "discovery",
      phaseLabel: label,
      percent: Math.max(2, Math.min(10, stepPercent)),
      placeCount,
      doneBatches: 0,
      totalBatches: 0,
      firmsProcessed: 0,
      insertedCount: run.insertedCount,
      updatedCount: run.updatedCount,
      discoveryStep,
      discoveryStepTotal,
      elapsedLabel,
      lastActivityLabel,
      isStale,
      scrapeMode,
      apiVersion,
    }
  }

  const percent =
    totalBatches > 0
      ? Math.min(99, Math.round(10 + (doneBatches / totalBatches) * 90))
      : 10

  return {
    locationLabel,
    phase: "details",
    phaseLabel: `Importing firm details — batch ${doneBatches}/${totalBatches}`,
    percent,
    placeCount,
    doneBatches,
    totalBatches,
    firmsProcessed,
    insertedCount: run.insertedCount,
    updatedCount: run.updatedCount,
    discoveryStep: discoveryStepTotal,
    discoveryStepTotal,
    elapsedLabel,
    lastActivityLabel,
    isStale,
    scrapeMode,
    apiVersion,
  }
}

export function isActiveGooglePlacesRun(run: ProspectImportRun | null | undefined): boolean {
  return (
    (run?.status === "RUNNING" || run?.status === "CANCELLING") &&
    (run.sourceSummary?.startsWith("google_places:") ?? false)
  )
}
