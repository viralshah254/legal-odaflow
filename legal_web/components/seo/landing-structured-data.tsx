import { getTranslations } from "next-intl/server"
import { JsonLd } from "@/components/seo/json-ld"
import {
  buildFaqPageSchema,
  buildOrganizationSchema,
  buildSoftwareApplicationSchema,
  buildWebSiteSchema,
  type FaqItem,
} from "@/lib/seo/structured-data"

/** Global structured data injected on the marketing home page. */
export async function LandingStructuredData() {
  const tMarketing = await getTranslations("marketing")
  const tLegal = await getTranslations("legal")
  const faqItems = (tMarketing.raw("home.faq.items") ?? []) as FaqItem[]

  const organization = buildOrganizationSchema({
    name: tMarketing("siteName"),
    description: tMarketing("siteDescription"),
    publisherName: tLegal("publisherName"),
  })

  const website = buildWebSiteSchema({
    name: tMarketing("siteName"),
    description: tMarketing("siteDescription"),
  })

  const software = buildSoftwareApplicationSchema({
    name: tMarketing("siteName"),
    description: tMarketing("siteDescription"),
  })

  const faq = faqItems.length > 0 ? buildFaqPageSchema(faqItems) : null

  return (
    <JsonLd
      data={[organization, website, software, ...(faq ? [faq] : [])]}
    />
  )
}
