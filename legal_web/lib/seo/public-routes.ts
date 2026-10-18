import { SEO_PILLAR_SLUGS, seoPillarPath } from "@/lib/seo/seo-pillars"

/** Static marketing routes included in the sitemap. */
export const PUBLIC_SITEMAP_ROUTES = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/solutions", priority: 0.99, changeFrequency: "weekly" as const },
  ...SEO_PILLAR_SLUGS.map((slug) => ({
    path: seoPillarPath(slug),
    priority: 0.97 as const,
    changeFrequency: "weekly" as const,
  })),
  { path: "/legal-ai", priority: 0.98, changeFrequency: "weekly" as const },
  { path: "/legal-issue-checker", priority: 0.96, changeFrequency: "weekly" as const },
  { path: "/for-lawyers", priority: 0.95, changeFrequency: "weekly" as const },
  { path: "/for-law-firms", priority: 0.95, changeFrequency: "weekly" as const },
  { path: "/in", priority: 0.92, changeFrequency: "weekly" as const },
  { path: "/us", priority: 0.92, changeFrequency: "weekly" as const },
  { path: "/gb", priority: 0.92, changeFrequency: "weekly" as const },
  { path: "/ke", priority: 0.92, changeFrequency: "weekly" as const },
  { path: "/learn-more", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/legal-guides", priority: 0.88, changeFrequency: "weekly" as const },
  { path: "/pricing", priority: 0.88, changeFrequency: "weekly" as const },
  { path: "/lawyers", priority: 0.85, changeFrequency: "weekly" as const },
  { path: "/upload-document", priority: 0.85, changeFrequency: "monthly" as const },
  { path: "/legal-forms", priority: 0.84, changeFrequency: "monthly" as const },
  { path: "/compare", priority: 0.75, changeFrequency: "monthly" as const },
  { path: "/compare/umbrella-vs-harvey", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/compare/umbrella-vs-legora", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/compare/umbrella-vs-lucio", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/compare/umbrella-vs-chatgpt", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/developers", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/demo", priority: 0.65, changeFrequency: "monthly" as const },
  { path: "/privacy", priority: 0.4, changeFrequency: "yearly" as const },
  { path: "/terms", priority: 0.4, changeFrequency: "yearly" as const },
  { path: "/legal-disclaimer", priority: 0.35, changeFrequency: "yearly" as const },
  { path: "/data-consent", priority: 0.35, changeFrequency: "yearly" as const },
] as const

/** Pre-rendered legal guide slugs (shared by sitemap and guide pages). */
export const LEGAL_GUIDE_STATIC_PARAMS = [
  { country: "in", slug: "employment-dispute" },
  { country: "in", slug: "tenant-eviction" },
  { country: "in", slug: "consumer-complaint" },
  { country: "in", slug: "cheque-bounce" },
  { country: "in", slug: "property-dispute" },
  { country: "us", slug: "wrongful-termination" },
  { country: "us", slug: "landlord-tenant" },
  { country: "us", slug: "small-claims" },
  { country: "us", slug: "eviction-rights" },
  { country: "us", slug: "employment-discrimination" },
  { country: "ke", slug: "employment-rights" },
  { country: "ke", slug: "land-dispute" },
  { country: "ke", slug: "consumer-rights" },
  { country: "ke", slug: "employment-termination" },
  { country: "gb", slug: "employment-tribunal" },
  { country: "gb", slug: "housing-disrepair" },
  { country: "gb", slug: "unfair-dismissal" },
  { country: "gb", slug: "tenant-rights" },
] as const

export function legalGuidePath(country: string, slug: string): string {
  return `/legal-guides/${country.toLowerCase()}/${slug.toLowerCase()}`
}
