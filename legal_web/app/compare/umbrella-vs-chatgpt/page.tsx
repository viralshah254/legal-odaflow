import type { Metadata } from "next"
import { CompareTablePage } from "@/components/marketing/compare-table-page"
import { buildCompareChatGptMetadata } from "@/lib/seo/site-metadata"

export async function generateMetadata(): Promise<Metadata> {
  return buildCompareChatGptMetadata()
}

export default function CompareChatGptPage() {
  return <CompareTablePage namespace="compareChatGpt" competitorLabelKey="chatgptLabel" />
}
