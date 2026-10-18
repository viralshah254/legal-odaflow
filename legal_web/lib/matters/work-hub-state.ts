export const WORK_HUB_VIEWS = ["tasks", "meetings", "notes", "activity"] as const
export type WorkHubView = (typeof WORK_HUB_VIEWS)[number]

export function resolveWorkHubView(value: string | null | undefined): WorkHubView {
  return WORK_HUB_VIEWS.includes(value as WorkHubView)
    ? (value as WorkHubView)
    : "tasks"
}

export function buildWorkHubHref(
  matterId: string,
  view: WorkHubView,
  currentQuery = "",
): string {
  const query = new URLSearchParams(currentQuery)
  if (view === "tasks") query.delete("view")
  else query.set("view", view)
  const suffix = query.toString()
  return `/app/matters/${matterId}/work${suffix ? `?${suffix}` : ""}`
}

export function buildLegacyWorkRedirect(
  view: "tasks" | "meetings",
  currentQuery = "",
  routeMatterId?: string,
): string {
  const query = new URLSearchParams(currentQuery)
  const matterId = routeMatterId ?? query.get("matterId") ?? undefined
  query.delete("matterId")

  if (!matterId) {
    query.set("workView", view)
    const suffix = query.toString()
    return `/app/matters${suffix ? `?${suffix}` : ""}`
  }

  return buildWorkHubHref(matterId, view, query.toString())
}
