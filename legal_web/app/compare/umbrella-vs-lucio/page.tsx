import type { Metadata } from "next"
import { CompareTablePage } from "@/components/marketing/compare-table-page"
import { buildCompareLucioMetadata } from "@/lib/seo/site-metadata"

export async function generateMetadata(): Promise<Metadata> {
  return buildCompareLucioMetadata()
}

export default function CompareLucioPage() {
  return <CompareTablePage namespace="compareLucio" competitorLabelKey="lucioLabel" />
}
