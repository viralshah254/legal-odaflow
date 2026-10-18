import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PublicPolicyPage } from "@/components/legal/public-policy-page"
import { buildPageMetadata, SITE_NAME } from "@/lib/seo/site-metadata"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal")
  return buildPageMetadata(
    {
      title: t("termsTitle"),
      description: t("termsDescription"),
      path: "/terms",
    },
    SITE_NAME,
  )
}

export default async function TermsPage() {
  const t = await getTranslations("legal")

  return (
    <PublicPolicyPage
      title={t("termsTitle")}
      description={t("termsDescription")}
      homeLabel={t("policyHome")}
    >
      <section>
        <h2>{t("termsAgreementHeading")}</h2>
        <p>{t("termsAgreementBody")}</p>
      </section>
      <section>
        <h2>{t("termsDefinitionsHeading")}</h2>
        <p>{t("termsDefinitionsBody")}</p>
      </section>
      <section>
        <h2>{t("termsAccountHeading")}</h2>
        <p>{t("termsAccountBody")}</p>
      </section>
      <section>
        <h2>{t("termsPermittedUseHeading")}</h2>
        <p>{t("termsPermittedUseBody")}</p>
      </section>
      <section>
        <h2>{t("termsProhibitedUseHeading")}</h2>
        <p>{t("termsProhibitedUseBody")}</p>
      </section>
      <section>
        <h2>{t("termsSubscriptionHeading")}</h2>
        <p>{t("termsSubscriptionBody")}</p>
      </section>
      <section>
        <h2>{t("termsTrialHeading")}</h2>
        <p>{t("termsTrialBody")}</p>
      </section>
      <section>
        <h2>{t("termsRefundHeading")}</h2>
        <p>{t("termsRefundBody")}</p>
      </section>
      <section>
        <h2>{t("termsAIOutputsHeading")}</h2>
        <p>{t("termsAIOutputsBody")}</p>
      </section>
      <section>
        <h2>{t("termsNotLawFirmHeading")}</h2>
        <p>{t("termsNotLawFirmBody")}</p>
      </section>
      <section>
        <h2>{t("termsLawyerUsersHeading")}</h2>
        <p>{t("termsLawyerUsersBody")}</p>
      </section>
      <section>
        <h2>{t("termsIPHeading")}</h2>
        <p>{t("termsIPPlatformBody")}</p>
        <p>{t("termsIPContentBody")}</p>
      </section>
      <section>
        <h2>{t("termsConfidentialityHeading")}</h2>
        <p>{t("termsConfidentialityBody")}</p>
      </section>
      <section>
        <h2>{t("termsWarrantiesHeading")}</h2>
        <p>{t("termsWarrantiesBody")}</p>
      </section>
      <section>
        <h2>{t("termsDataHeading")}</h2>
        <p>
          {t("termsDataBody")}{" "}
          <a href="/privacy">{t("termsDataPrivacyLink")}</a>.{" "}
          <a href="/data-consent">{t("termsDataConsentLink")}</a>.
        </p>
      </section>
      <section>
        <h2>{t("termsLiabilityHeading")}</h2>
        <p>{t("termsLiabilityBody")}</p>
      </section>
      <section>
        <h2>{t("termsIndemnityHeading")}</h2>
        <p>{t("termsIndemnityBody")}</p>
      </section>
      <section>
        <h2>{t("termsDisputeHeading")}</h2>
        <p>{t("termsDisputeBody")}</p>
      </section>
      <section>
        <h2>{t("termsSeverabilityHeading")}</h2>
        <p>{t("termsSeverabilityBody")}</p>
      </section>
      <section>
        <h2>{t("termsChangesHeading")}</h2>
        <p>{t("termsChangesBody")}</p>
      </section>
      <section>
        <h2>{t("termsContactHeading")}</h2>
        <p>{t("termsContactBody")}</p>
      </section>
    </PublicPolicyPage>
  )
}
