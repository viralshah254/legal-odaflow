import type { Metadata } from "next"
import { CompareTablePage } from "@/components/marketing/compare-table-page"
import { buildCompareHarveyMetadata } from "@/lib/seo/site-metadata"

export async function generateMetadata(): Promise<Metadata> {
  return buildCompareHarveyMetadata()
}

export default function CompareHarveyPage() {
  return <CompareTablePage namespace="compareHarvey" competitorLabelKey="harveyLabel" />
}
