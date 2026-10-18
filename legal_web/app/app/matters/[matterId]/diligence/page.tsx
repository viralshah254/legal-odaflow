import { redirect } from "next/navigation"

export default function MatterDiligenceCompatibilityPage({
  params,
}: {
  params: { matterId: string }
}) {
  redirect(`/app/matters/${params.matterId}/documents?view=ai-review`)
}
