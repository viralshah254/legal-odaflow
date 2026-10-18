import { redirect } from "next/navigation"

/** Legacy public URL — route into the authenticated app shell. */
export default function LegacySectionFinderRedirect({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const q = searchParams.q?.trim()
  redirect(q ? `/app/section-finder?q=${encodeURIComponent(q)}` : "/app/section-finder")
}
