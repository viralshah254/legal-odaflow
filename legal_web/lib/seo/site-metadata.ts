import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { getAppUrl } from "@/lib/app-url"
import {
  COUNTRY_MARKETS,
  type CountryMarketCode,
} from "@/lib/seo/country-markets"
import { GLOBAL_SEO_KEYWORDS } from "@/lib/seo/global-keywords"
import { seoPillarPath, type SeoPillarSlug } from "@/lib/seo/seo-pillars"
import { toCanonicalPath, toCanonicalUrl } from "@/lib/seo/canonical-path"

export { DEFAULT_APP_URL, getAppUrl, buildReferralShareUrl } from "@/lib/app-url"

/** Fallback constants for non-async consumers (OG image generator, etc.) */
export const SITE_NAME = "Umbrella"
export const SITE_TAGLINE =
  "The global legal AI platform — understand any legal situation, draft any document, run any firm."
export const SITE_DESCRIPTION =
  "Umbrella is global legal AI: free issue checker with real citations, AI document drafting, contract review, legal research, and a full law firm OS — deepest coverage in India, US, Kenya, and the UK, with best-effort research worldwide."
export const SITE_TITLE = `${SITE_NAME} — Global Legal AI Platform`
export const SITE_KEYWORDS = [...GLOBAL_SEO_KEYWORDS]

export function getSiteUrl(): string {
  return getAppUrl()
}

export interface PageMetadataInput {
  title: string
  description: string
  path?: string
  keywords?: string[]
  openGraphLocale?: string
}

function defaultOpenGraphImages(siteUrl: string): NonNullable<Metadata["openGraph"]>["images"] {
  return [
    {
      url: toCanonicalUrl(siteUrl, "/opengraph-image"),
      width: 1200,
      height: 630,
      alt: SITE_TITLE,
    },
  ]
}

export const NOINDEX_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

export function buildPageMetadata(input: PageMetadataInput, siteName: string = SITE_NAME): Metadata {
  const siteUrl = getSiteUrl()
  const canonicalPath = toCanonicalPath(input.path ?? "/")
  const canonicalUrl = toCanonicalUrl(siteUrl, canonicalPath)

  return {
    title: input.title,
    description: input.description,
    ...(input.keywords?.length ? { keywords: input.keywords } : {}),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url: canonicalUrl,
      siteName,
      locale: input.openGraphLocale ?? "en_US",
      type: "website",
      images: defaultOpenGraphImages(siteUrl),
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [toCanonicalUrl(siteUrl, "/twitter-image")],
    },
  }
}

export async function buildRootMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing")
  const tLegal = await getTranslations("legal")
  const siteUrl = getSiteUrl()
  const siteName = t("siteName")
  const siteTitle = t("siteTitle")
  const siteDescription = t("siteDescription")

  const verification: Metadata["verification"] = {}
  const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim()
  const bingVerification = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim()
  if (googleVerification) verification.google = googleVerification
  if (bingVerification) verification.other = { "msvalidate.01": bingVerification }

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: siteTitle,
      template: `%s | ${siteName}`,
    },
    description: siteDescription,
    applicationName: siteName,
    keywords: SITE_KEYWORDS,
    authors: [{ name: tLegal("publisherName") }],
    creator: tLegal("publisherName"),
    publisher: tLegal("publisherName"),
    category: "Legal Technology",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    icons: {
      icon: [
        { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: [{ url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }],
      shortcut: "/brand/favicon-32.png",
    },
    alternates: {
      canonical: toCanonicalUrl(siteUrl, "/"),
    },
    openGraph: {
      title: siteTitle,
      description: siteDescription,
      url: toCanonicalUrl(siteUrl, "/"),
      siteName,
      locale: "en_US",
      type: "website",
      images: defaultOpenGraphImages(siteUrl),
    },
    twitter: {
      card: "summary_large_image",
      title: siteTitle,
      description: siteDescription,
      images: [toCanonicalUrl(siteUrl, "/twitter-image")],
    },
    ...(Object.keys(verification).length > 0 ? { verification } : {}),
  }
}

export async function buildIssueCheckerMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing")
  const siteName = t("siteName")
  return buildPageMetadata(
    {
      title: t("issueCheckerMetaTitle"),
      description: t("issueCheckerMetaDescription"),
      path: "/legal-issue-checker",
    },
    siteName,
  )
}

export async function buildForLawyersMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing")
  const siteName = t("siteName")
  return buildPageMetadata(
    {
      title: "Legal Practice Software for Independent Lawyers",
      description:
        "Manage matters, research, drafting, documents, deadlines and billing in one connected workspace built for independent lawyers.",
      path: "/for-lawyers",
    },
    siteName,
  )
}

export async function buildForLawFirmsMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing")
  const siteName = t("siteName")
  return buildPageMetadata(
    {
      title: "Law Firm Software for Connected Legal Operations",
      description:
        "Connect matters, teams, workflows, documents and billing in one legal operating system built for modern law firms.",
      path: "/for-law-firms",
    },
    siteName,
  )
}

export async function buildLegalAiMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing")
  const siteName = t("siteName")
  return buildPageMetadata(
    {
      title: t("legalAi.metaTitle"),
      description: t("legalAi.metaDescription"),
      path: "/legal-ai",
    },
    siteName,
  )
}

export async function buildCompareChatGptMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing")
  const siteName = t("siteName")
  return buildPageMetadata(
    {
      title: t("compareChatGpt.metaTitle"),
      description: t("compareChatGpt.metaDescription"),
      path: "/compare/umbrella-vs-chatgpt",
      keywords: ["Umbrella vs ChatGPT", "legal AI vs ChatGPT", "ChatGPT legal alternative"],
    },
    siteName,
  )
}

export async function buildCompareHarveyMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing")
  const siteName = t("siteName")
  return buildPageMetadata(
    {
      title: t("compareHarvey.metaTitle"),
      description: t("compareHarvey.metaDescription"),
      path: "/compare/umbrella-vs-harvey",
      keywords: [
        "Harvey AI alternative",
        "Umbrella vs Harvey",
        "legal AI for consumers and firms",
        "Harvey AI competitor",
      ],
    },
    siteName,
  )
}

export async function buildCompareLucioMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing")
  const siteName = t("siteName")
  return buildPageMetadata(
    {
      title: t("compareLucio.metaTitle"),
      description: t("compareLucio.metaDescription"),
      path: "/compare/umbrella-vs-lucio",
      keywords: [
        "Lucio AI alternative",
        "Umbrella vs Lucio",
        "legal Word add-in",
        "Outlook narratives legal AI",
        "Lucio AI competitor",
      ],
    },
    siteName,
  )
}

export async function buildCompareLegoraMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing")
  const siteName = t("siteName")
  return buildPageMetadata(
    {
      title: t("compareLegora.metaTitle"),
      description: t("compareLegora.metaDescription"),
      path: "/compare/umbrella-vs-legora",
      keywords: [
        "Legora alternative",
        "Umbrella vs Legora",
        "legal AI India UK Kenya",
        "Legora competitor",
      ],
    },
    siteName,
  )
}

export async function buildCompareHubMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing")
  const siteName = t("siteName")
  return buildPageMetadata(
    {
      title: t("compareHub.metaTitle"),
      description: t("compareHub.metaDescription"),
      path: "/compare",
    },
    siteName,
  )
}

export async function buildCountryMarketMetadata(code: CountryMarketCode): Promise<Metadata> {
  const t = await getTranslations("marketing")
  const siteName = t("siteName")
  const config = COUNTRY_MARKETS[code]
  return buildPageMetadata(
    {
      title: t(`countryPages.${code}.metaTitle`),
      description: t(`countryPages.${code}.metaDescription`),
      path: config.path,
      keywords: config.keywords,
      openGraphLocale: config.openGraphLocale,
    },
    siteName,
  )
}

export async function buildDemoMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing")
  return buildPageMetadata(
    {
      title: t("demoMetaTitle"),
      description: t("demoMetaDescription"),
      path: "/demo",
    },
    t("siteName"),
  )
}

export async function buildLawyersMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing")
  return buildPageMetadata(
    {
      title: t("lawyersMetaTitle"),
      description: t("lawyersMetaDescription"),
      path: "/lawyers",
    },
    t("siteName"),
  )
}

export async function buildUploadDocumentMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing")
  return buildPageMetadata(
    {
      title: t("uploadDocumentMetaTitle"),
      description: t("uploadDocumentMetaDescription"),
      path: "/upload-document",
    },
    t("siteName"),
  )
}

export async function buildLegalFormsMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing")
  return buildPageMetadata(
    {
      title: t("legalFormsMetaTitle"),
      description: t("legalFormsMetaDescription"),
      path: "/legal-forms",
    },
    t("siteName"),
  )
}

export async function buildLearnMoreMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing")
  return buildPageMetadata(
    {
      title: t("learnMoreMetaTitle"),
      description: t("learnMoreMetaDescription"),
      path: "/learn-more",
    },
    t("siteName"),
  )
}

export async function buildSeoPillarMetadata(slug: SeoPillarSlug): Promise<Metadata> {
  const t = await getTranslations("marketing")
  const keywords = (t.raw(`seoPillars.${slug}.keywords`) ?? []) as string[]
  return buildPageMetadata(
    {
      title: t(`seoPillars.${slug}.metaTitle`),
      description: t(`seoPillars.${slug}.metaDescription`),
      path: seoPillarPath(slug),
      keywords,
    },
    t("siteName"),
  )
}

export async function buildSolutionsHubMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing")
  return buildPageMetadata(
    {
      title: t("solutionsHub.metaTitle"),
      description: t("solutionsHub.metaDescription"),
      path: "/solutions",
      keywords: [...GLOBAL_SEO_KEYWORDS],
    },
    t("siteName"),
  )
}

/** @deprecated Use buildIssueCheckerMetadata() */
export const ISSUE_CHECKER_METADATA = buildPageMetadata(
  {
    title: "Free Legal Issue Checker",
    description:
      "Describe your legal problem and get a free AI preview with country-specific guidance for India, US, Kenya, and the UK.",
    path: "/legal-issue-checker",
  },
  SITE_NAME,
)

/** @deprecated Use buildForLawyersMetadata() */
export const FOR_LAWYERS_METADATA = buildPageMetadata(
  {
    title: "AI-Native Legal OS for Law Firms",
    description:
      "Matter-aware AI Copilot, legal research, billing, trust accounting, and automation — built for modern law firms.",
    path: "/for-lawyers",
  },
  SITE_NAME,
)
