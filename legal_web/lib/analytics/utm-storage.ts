const UTM_SESSION_KEY = "legal_utm_params"
const UTM_PARAM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const

export type UtmParams = Partial<Record<(typeof UTM_PARAM_KEYS)[number], string>>

/** Read UTM params from a URLSearchParams instance and store in sessionStorage. No-op if none present. */
export function persistUtmParams(searchParams: URLSearchParams): void {
  if (typeof window === "undefined") return
  const utms: UtmParams = {}
  for (const key of UTM_PARAM_KEYS) {
    const val = searchParams.get(key)
    if (val) utms[key] = val
  }
  if (Object.keys(utms).length === 0) return
  sessionStorage.setItem(UTM_SESSION_KEY, JSON.stringify(utms))
}

/** Retrieve persisted UTM params from sessionStorage. Returns empty object if none. */
export function resolveUtmParams(): UtmParams {
  if (typeof window === "undefined") return {}
  try {
    const raw = sessionStorage.getItem(UTM_SESSION_KEY)
    return raw ? (JSON.parse(raw) as UtmParams) : {}
  } catch {
    return {}
  }
}

/** Map snake_case UTM params to camelCase fields expected by site-analytics ingest. */
export function resolveUtmSessionFields(): {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
} {
  const utms = resolveUtmParams()
  return {
    utmSource: utms.utm_source,
    utmMedium: utms.utm_medium,
    utmCampaign: utms.utm_campaign,
    utmContent: utms.utm_content,
    utmTerm: utms.utm_term,
  }
}
