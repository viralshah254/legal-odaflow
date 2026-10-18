import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PublicPolicyPage } from "@/components/legal/public-policy-page"
import { buildPageMetadata, SITE_NAME } from "@/lib/seo/site-metadata"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal")
  return buildPageMetadata(
    {
      title: t("privacyTitle"),
      description: t("privacyDescription"),
      path: "/privacy",
    },
    SITE_NAME,
  )
}

export default async function PrivacyPage() {
  const t = await getTranslations("legal")

  return (
    <PublicPolicyPage
      title={t("privacyTitle")}
      description={t("privacyDescription")}
      homeLabel={t("policyHome")}
    >
      <section>
        <h2>{t("privacyControllerHeading")}</h2>
        <p>{t("privacyControllerBody")}</p>
      </section>
      <section>
        <h2>{t("privacyLegalBasisHeading")}</h2>
        <p>{t("privacyLegalBasisBody")}</p>
      </section>
      <section>
        <h2>{t("privacyCollectHeading")}</h2>
        <ul>
          <li>{t("privacyCollectAccountBody")}</li>
          <li>{t("privacyCollectUsageBody")}</li>
          <li>{t("privacyCollectDeviceBody")}</li>
          <li>{t("privacyCollectContentBody")}</li>
          <li>{t("privacyCollectBillingBody")}</li>
          <li>{t("privacyCollectCookiesBody")}</li>
        </ul>
      </section>
      <section>
        <h2>{t("privacyUseHeading")}</h2>
        <p>{t("privacyUseBody")}</p>
      </section>
      <section>
        <h2>{t("privacySharingHeading")}</h2>
        <p>{t("privacySharingBody")}</p>
        <ul>
          <li>{t("privacySharingSubprocessors")}</li>
          <li>{t("privacySharingLawyerReview")}</li>
          <li>{t("privacySharingLegal")}</li>
        </ul>
      </section>
      <section>
        <h2>{t("privacyRetentionHeading")}</h2>
        <p>{t("privacyRetentionBody")}</p>
      </section>
      <section>
        <h2>{t("privacySecurityHeading")}</h2>
        <p>{t("privacySecurityBody")}</p>
      </section>
      <section>
        <h2>{t("privacyChildrenHeading")}</h2>
        <p>{t("privacyChildrenBody")}</p>
      </section>
      <section>
        <h2>{t("privacyRightsHeading")}</h2>
        <p>{t("privacyRightsGDPRBody")}</p>
        <p>{t("privacyRightsDPDPBody")}</p>
        <p>{t("privacyRightsCCPABody")}</p>
        <p>{t("privacyRightsKenyaBody")}</p>
      </section>
      <section>
        <h2>{t("privacyTransfersHeading")}</h2>
        <p>{t("privacyTransfersBody")}</p>
      </section>
      <section>
        <h2>{t("privacyAutomatedHeading")}</h2>
        <p>{t("privacyAutomatedBody")}</p>
      </section>
      <section>
        <h2>{t("privacyCookiesHeading")}</h2>
        <p>{t("privacyCookiesBody")}</p>
      </section>
      <section>
        <h2>{t("privacyChangesHeading")}</h2>
        <p>{t("privacyChangesBody")}</p>
      </section>
      <section>
        <h2>{t("privacyContactHeading")}</h2>
        <p>{t("privacyContactBody")}</p>
      </section>
    </PublicPolicyPage>
  )
}
