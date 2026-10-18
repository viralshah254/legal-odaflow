/** SEO pillar landing pages — high-intent legal keyword targets. */
export const SEO_PILLAR_SLUGS = [
  "legal-document-drafting",
  "legal-research",
  "contract-review",
  "document-review",
  "law-firm-software",
  "legal-copilot",
  "legal-workflow-automation",
  "contract-analysis",
  "legal-assistant",
  "practice-management",
  "legal-due-diligence",
  "legal-issue-analysis",
] as const

export type SeoPillarSlug = (typeof SEO_PILLAR_SLUGS)[number]

export function isSeoPillarSlug(value: string): value is SeoPillarSlug {
  return (SEO_PILLAR_SLUGS as readonly string[]).includes(value)
}

export function seoPillarPath(slug: SeoPillarSlug): string {
  return `/solutions/${slug}`
}

/** Primary CTA path per pillar — routes users to the best conversion page. */
export const SEO_PILLAR_CTA: Record<SeoPillarSlug, string> = {
  "legal-document-drafting": "/legal-forms",
  "legal-research": "/legal-issue-checker",
  "contract-review": "/upload-document",
  "document-review": "/upload-document",
  "law-firm-software": "/for-law-firms",
  "legal-copilot": "/for-lawyers",
  "legal-workflow-automation": "/for-lawyers",
  "contract-analysis": "/upload-document",
  "legal-assistant": "/legal-issue-checker",
  "practice-management": "/for-lawyers",
  "legal-due-diligence": "/upload-document",
  "legal-issue-analysis": "/legal-issue-checker",
}
