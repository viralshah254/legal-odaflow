import type { Metadata } from "next"
import { CompareTablePage } from "@/components/marketing/compare-table-page"
import { buildCompareLegoraMetadata } from "@/lib/seo/site-metadata"

export async function generateMetadata(): Promise<Metadata> {
  return buildCompareLegoraMetadata()
}

export default function CompareLegoraPage() {
  return <CompareTablePage namespace="compareLegora" competitorLabelKey="legoraLabel" />
}
