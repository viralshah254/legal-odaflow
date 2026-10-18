import type { Metadata } from "next"
import { buildLearnMoreMetadata } from "@/lib/seo/site-metadata"

export async function generateMetadata(): Promise<Metadata> {
  return buildLearnMoreMetadata()
}

export default function LearnMoreLayout({ children }: { children: React.ReactNode }) {
  return children
}
