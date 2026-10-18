import type { MetadataRoute } from "next"
import { getAppUrl } from "@/lib/app-url"
import { toCanonicalUrl } from "@/lib/seo/canonical-path"
import { LEGAL_GUIDE_STATIC_PARAMS, legalGuidePath, PUBLIC_SITEMAP_ROUTES } from "@/lib/seo/public-routes"

/** Keep sitemap statically servable for crawlers (Google Search Console, etc.). */
export const dynamic = "force-static"
export const revalidate = 86400

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getAppUrl()
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_SITEMAP_ROUTES.map((route) => ({
    url: toCanonicalUrl(siteUrl, route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))

  const guideEntries: MetadataRoute.Sitemap = LEGAL_GUIDE_STATIC_PARAMS.map(({ country, slug }) => ({
    url: toCanonicalUrl(siteUrl, legalGuidePath(country, slug)),
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  return [...staticEntries, ...guideEntries]
}
