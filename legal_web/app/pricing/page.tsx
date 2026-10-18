import type { Metadata } from "next"
import { headers } from "next/headers"
import { PricingPageContent } from "@/components/pricing/pricing-page-content"
import { buildPageMetadata, SITE_NAME } from "@/lib/seo/site-metadata"
import { fetchPricingCatalog } from "@/lib/api/pricing-plans"
import { resolvePricingCountry } from "@/lib/pricing/detect-pricing-country"
import { emptyPricingCatalog } from "@/lib/pricing/empty-catalog"

export const metadata: Metadata = buildPageMetadata({
  title: "Pricing",
  description:
    "Consumer and law firm plans with per-seat pricing, AI credits, and Copilot.",
  path: "/pricing",
}, SITE_NAME)

type PricingPageProps = {
  searchParams: Promise<{ country?: string }>
}

const CONFIDENT_SSR_SOURCES = new Set(["query", "vercel-ip-country", "cf-ipcountry", "ip", "ipapi"])

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const { country: explicitCountry } = await searchParams
  const headerList = headers()
  const forwardedFor =
    headerList.get("x-forwarded-for") ?? headerList.get("x-real-ip") ?? undefined
  const cfIpCountry = headerList.get("cf-ipcountry") ?? undefined
  // Vercel injects x-vercel-ip-country on every request (Edge + Serverless)
  const vercelIpCountry = headerList.get("x-vercel-ip-country") ?? undefined

  const { countryCode, source } = await resolvePricingCountry({
    explicitCountry,
    forwardedFor,
    cfIpCountry,
    vercelIpCountry,
  })

  const prefetch =
    Boolean(explicitCountry) ||
    (source !== "default" && CONFIDENT_SSR_SOURCES.has(source))

  let firmCatalog = emptyPricingCatalog()
  let consumerCatalog = emptyPricingCatalog()

  if (prefetch || explicitCountry) {
    ;[firmCatalog, consumerCatalog] = await Promise.all([
      fetchPricingCatalog({ countryCode, userType: "LAW_FIRM" }),
      fetchPricingCatalog({ countryCode, userType: "CONSUMER" }),
    ])
  }

  return (
    <PricingPageContent
      initialCountryCode={prefetch || explicitCountry ? countryCode : ""}
      explicitCountry={explicitCountry ?? null}
      firmCatalog={firmCatalog}
      consumerCatalog={consumerCatalog}
      skipGeoGate={Boolean(explicitCountry)}
      ssrDetectionSource={source}
    />
  )
}
