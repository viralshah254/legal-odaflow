import type { Metadata } from "next"
import { Suspense } from "react"
import { LegalIssueCheckerWizard } from "@/components/issue-checker/legal-issue-checker-wizard"
import { buildIssueCheckerMetadata } from "@/lib/seo/site-metadata"

export async function generateMetadata(): Promise<Metadata> {
  return buildIssueCheckerMetadata()
}

export default function LegalIssueCheckerPage() {
  return (
    <Suspense>
      <LegalIssueCheckerWizard layout="marketing" />
    </Suspense>
  )
}
