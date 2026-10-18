import { getApiBaseUrl } from "@/lib/api/api-base"
import { resolveApiFetchPath } from "@/lib/api/client"
import { getDistinctId } from "./events"
import { resolveUtmSessionFields } from "./utm-storage"

function analyticsUrl(path: string): string {
  return `${getApiBaseUrl()}${resolveApiFetchPath(path)}`
}

export interface SiteEventPayload {
  eventName: string
  path?: string
  properties?: Record<string, unknown>
  // Session bootstrap fields (for first page_view)
  landingPath?: string
  referrer?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  deviceType?: string
  countryCode?: string
}

let pendingBatch: SiteEventPayload[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

/** Send a batch of events to the backend. Fire-and-forget — never throws. */
function flush(heartbeatSeconds = 0): void {
  if (typeof window === "undefined") return
  if (pendingBatch.length === 0 && heartbeatSeconds === 0) return

  const visitorId = getDistinctId()
  const events = pendingBatch.splice(0).map((event) => ({ ...event, visitorId }))

  const payload = JSON.stringify({ events, heartbeatSeconds })
  const url = analyticsUrl("/analytics/site/events")

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }))
    } else {
      void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {})
    }
  } catch {
    // Analytics must never break UX
  }
}

function scheduledFlush(): void {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => flush(), 500)
}

/** Queue a site event for batched delivery. */
export function trackSiteEvent(event: SiteEventPayload): void {
  if (typeof window === "undefined") return
  pendingBatch.push(event)
  scheduledFlush()
}

/** Send a page_view event with full session bootstrap info. */
export function trackPageView(path: string): void {
  const deviceType = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop"
  trackSiteEvent({
    eventName: "page_view",
    path,
    landingPath: path,
    referrer: document.referrer || undefined,
    deviceType,
    ...resolveUtmSessionFields(),
  })
}

/** Send a 30-second heartbeat to accumulate active session time. */
export function sendHeartbeat(): void {
  if (typeof window === "undefined") return
  const visitorId = getDistinctId()
  const url = analyticsUrl("/analytics/site/events")
  const payload = JSON.stringify({ visitorId, events: [], heartbeatSeconds: 30 })
  try {
    void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {})
  } catch {
    // ignore
  }
}

/** Associate the current visitorId with a userId (call after login/signup). */
export function identifyVisitor(userId: string): void {
  if (typeof window === "undefined") return
  const visitorId = getDistinctId()
  const url = analyticsUrl("/analytics/site/identify")
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId, userId }),
    keepalive: true,
  }).catch(() => {})
}
