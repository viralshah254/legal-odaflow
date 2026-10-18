import type { MetadataRoute } from "next"
import { getAppUrl } from "@/lib/app-url"
import { toCanonicalUrl } from "@/lib/seo/canonical-path"

export const dynamic = "force-static"
export const revalidate = 86400

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getAppUrl()

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/app/",
          "/consumer/",
          "/admin/",
          "/auth/",
          "/portal/",
          "/api/",
          "/pay/",
          "/subscription/",
          "/onboarding/",
          "/superadmin/",
          "/book/",
        ],
      },
    ],
    sitemap: toCanonicalUrl(siteUrl, "/sitemap.xml"),
    host: siteUrl.replace(/\/$/, ""),
  }
}
