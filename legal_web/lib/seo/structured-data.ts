import { getAppUrl } from "@/lib/app-url"
import { toCanonicalUrl } from "@/lib/seo/canonical-path"

export interface FaqItem {
  question: string
  answer: string
}

export function buildOrganizationSchema(input: {
  name: string
  description: string
  publisherName: string
}) {
  const siteUrl = getAppUrl()
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name,
    legalName: input.publisherName,
    url: siteUrl,
    logo: toCanonicalUrl(siteUrl, "/brand/icon-512.png"),
    description: input.description,
    areaServed: {
      "@type": "Place",
      name: "Worldwide",
    },
    sameAs: [] as string[],
  }
}

export function buildWebSiteSchema(input: {
  name: string
  description: string
}) {
  const siteUrl = getAppUrl()
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: input.name,
    url: siteUrl,
    description: input.description,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: toCanonicalUrl(siteUrl, "/legal-issue-checker"),
      },
      "query-input": "required name=search_term_string",
    },
  }
}

export function buildSoftwareApplicationSchema(input: {
  name: string
  description: string
}) {
  const siteUrl = getAppUrl()
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: input.name,
    applicationCategory: "LegalApplication",
    operatingSystem: "Web, iOS, Android, macOS, Windows",
    url: siteUrl,
    description: input.description,
    areaServed: {
      "@type": "Place",
      name: "Worldwide",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free legal issue checker preview with paid upgrades worldwide",
    },
  }
}

export function buildFaqPageSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }
}

export function buildArticleSchema(input: {
  title: string
  description: string
  path: string
  countryLabel: string
}) {
  const siteUrl = getAppUrl()
  const url = toCanonicalUrl(siteUrl, input.path)
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    url,
    inLanguage: "en",
    author: {
      "@type": "Organization",
      name: "Umbrella",
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "Umbrella",
      logo: {
        "@type": "ImageObject",
        url: toCanonicalUrl(siteUrl, "/brand/icon-512.png"),
      },
    },
    about: {
      "@type": "Thing",
      name: `${input.countryLabel} legal information`,
    },
  }
}
