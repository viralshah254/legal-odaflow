import type { Metadata } from "next"
import { buildIssueCheckerMetadata } from "@/lib/seo/site-metadata"

export async function generateMetadata(): Promise<Metadata> {
  return buildIssueCheckerMetadata()
}

export default function LegalIssueCheckerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
