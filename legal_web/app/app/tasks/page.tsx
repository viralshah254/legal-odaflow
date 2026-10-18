import { redirect } from "next/navigation"

import { buildLegacyWorkRedirect } from "@/lib/matters/work-hub-state"

export default function LegacyTasksPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const query = new URLSearchParams()
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item))
    else if (value !== undefined) query.set(key, value)
  })
  redirect(buildLegacyWorkRedirect("tasks", query.toString()))
}
