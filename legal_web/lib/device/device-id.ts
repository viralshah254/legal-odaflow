const STORAGE_KEY = "umbrella_device_id"

/**
 * Returns a stable per-browser device ID stored in localStorage.
 * Created on first call; never sent to the server raw — the backend
 * hashes it with a server-side salt before storing.
 *
 * Returns null when called server-side (no window).
 */
export function getDeviceId(): string | null {
  if (typeof window === "undefined") return null

  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Private-browsing or storage quota — use ephemeral value
    }
  }
  return id
}
