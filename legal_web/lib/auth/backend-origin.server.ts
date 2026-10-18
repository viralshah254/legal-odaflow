/** Server-side backend origin for auth BFF and API proxy routes. */
export function resolveBackendOrigin(): string {
  const candidates = [process.env.API_URL, process.env.NEXT_PUBLIC_API_URL]

  for (const candidate of candidates) {
    if (!candidate) continue
    const clean = candidate.replace(/\/$/, "")
    if (/127\.0\.0\.1|localhost/.test(clean) && process.env.NODE_ENV === "production") {
      continue
    }
    return clean
  }

  return "http://127.0.0.1:4000"
}

export function backendApiUrl(path: string): string {
  const queryIndex = path.indexOf("?")
  const pathOnly = queryIndex >= 0 ? path.slice(0, queryIndex) : path
  const query = queryIndex >= 0 ? path.slice(queryIndex) : ""
  const normalized = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`
  const withSlash = normalized.endsWith("/") ? normalized : `${normalized}/`
  return `${resolveBackendOrigin()}/api/v1${withSlash}${query}`
}
