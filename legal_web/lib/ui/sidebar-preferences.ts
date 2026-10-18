export const SIDEBAR_MINIMIZED_KEY = "sidebar-minimized"

export function readSidebarMinimizedPreference(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_MINIMIZED_KEY) === "true"
  } catch {
    return false
  }
}

export function persistSidebarMinimizedPreference(minimized: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_MINIMIZED_KEY, String(minimized))
  } catch {
    // ignore
  }
}
