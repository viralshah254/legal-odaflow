import { redirect } from "next/navigation"

interface MatterAiRedirectPageProps {
  params: Promise<{ matterId: string }>
}

export default async function MatterAiRedirectPage({ params }: MatterAiRedirectPageProps) {
  const { matterId } = await params
  redirect(`/app/matters/${matterId}/workbench`)
}
