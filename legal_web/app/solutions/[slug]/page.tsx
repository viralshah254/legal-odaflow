import type { Metadata } from "next"
import { generateSeoPillarStaticParams, SeoPillarPage } from "@/components/marketing/seo-pillar-page"
import { buildSeoPillarMetadata } from "@/lib/seo/site-metadata"
import { isSeoPillarSlug } from "@/lib/seo/seo-pillars"

export function generateStaticParams() {
  return generateSeoPillarStaticParams()
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await Promise.resolve(params)
  if (!isSeoPillarSlug(slug)) return {}
  return buildSeoPillarMetadata(slug)
}

export default async function SolutionPillarPage({ params }: PageProps) {
  const { slug } = await Promise.resolve(params)
  return <SeoPillarPage slug={slug} />
}
