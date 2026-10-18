import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PublicPolicyPage } from "@/components/legal/public-policy-page"
import { buildPageMetadata, SITE_NAME } from "@/lib/seo/site-metadata"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal")
  return buildPageMetadata(
    {
      title: t("dataConsentTitle"),
      description: t("dataConsentDescription"),
      path: "/data-consent",
    },
    SITE_NAME,
  )
}

export default async function DataConsentPage() {
  const t = await getTranslations("legal")

  return (
    <PublicPolicyPage
      title={t("dataConsentTitle")}
      description={t("dataConsentDescription")}
      homeLabel={t("policyHome")}
    >
      <section>
        <h2>{t("dataConsentDefaultHeading")}</h2>
        <p>{t("dataConsentDefaultBody")}</p>
      </section>
      <section>
        <h2>{t("dataConsentWhatIsTrainingHeading")}</h2>
        <p>{t("dataConsentWhatIsTrainingBody")}</p>
      </section>
      <section>
        <h2>{t("dataConsentOptInHeading")}</h2>
        <p>{t("dataConsentOptInIntro")}</p>
        <ul>
          <li>{t("dataConsentOptInPrompt")}</li>
          <li>{t("dataConsentOptInEval")}</li>
          <li>{t("dataConsentOptInFineTune")}</li>
        </ul>
        <p>{t("dataConsentOptInAnonymize")}</p>
      </section>
      <section>
        <h2>{t("dataConsentNeverUsedHeading")}</h2>
        <p>{t("dataConsentNeverUsedBody")}</p>
      </section>
      <section>
        <h2>{t("dataConsentProvidersHeading")}</h2>
        <p>{t("dataConsentProvidersBody")}</p>
      </section>
      <section>
        <h2>{t("dataConsentCountryHeading")}</h2>
        <ul>
          <li>{t("dataConsentCountryGDPRBody")}</li>
          <li>{t("dataConsentCountryDPDPBody")}</li>
          <li>{t("dataConsentCountryKenyaBody")}</li>
          <li>{t("dataConsentCountryUSBody")}</li>
        </ul>
      </section>
      <section>
        <h2>{t("dataConsentManageHeading")}</h2>
        <p>{t("dataConsentManageBody")}</p>
        <ul>
          <li>
            <a href="/app/settings">{t("dataConsentFirmLink")}</a>
          </li>
          <li>
            <a href="/consumer/settings">{t("dataConsentConsumerLink")}</a>
          </li>
        </ul>
      </section>
      <section>
        <h2>{t("dataConsentWithdrawHeading")}</h2>
        <p>{t("dataConsentWithdrawBody")}</p>
      </section>
      <section>
        <h2>{t("dataConsentAuditHeading")}</h2>
        <p>{t("dataConsentAuditBody")}</p>
      </section>
      <section>
        <h2>{t("dataConsentRetentionHeading")}</h2>
        <p>{t("dataConsentRetentionBody")}</p>
      </section>
      <section>
        <h2>{t("dataConsentContactHeading")}</h2>
        <p>{t("dataConsentContactBody")}</p>
      </section>
    </PublicPolicyPage>
  )
}
