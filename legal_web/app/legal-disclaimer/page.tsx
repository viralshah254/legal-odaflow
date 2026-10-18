import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PublicPolicyPage } from "@/components/legal/public-policy-page"
import { buildPageMetadata, SITE_NAME } from "@/lib/seo/site-metadata"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal")
  return buildPageMetadata(
    {
      title: t("disclaimerPageTitle"),
      description: t("disclaimerPageDescription"),
      path: "/legal-disclaimer",
    },
    SITE_NAME,
  )
}

export default async function LegalDisclaimerPage() {
  const t = await getTranslations("legal")

  return (
    <PublicPolicyPage
      title={t("disclaimerPageTitle")}
      description={t("disclaimerPageDescription")}
      homeLabel={t("policyHome")}
    >
      <section>
        <h2>{t("disclaimerScopeHeading")}</h2>
        <p>{t("disclaimerScopeBody")}</p>
      </section>
      <section>
        <h2>{t("disclaimerUniversalHeading")}</h2>
        <p>{t("disclaimerUniversalBody")}</p>
      </section>
      <section>
        <h2>{t("disclaimerAINotLawyerHeading")}</h2>
        <p>{t("disclaimerAINotLawyerBody")}</p>
      </section>
      <section>
        <h2>{t("disclaimerCitationHeading")}</h2>
        <p>{t("disclaimerCitationBody")}</p>
      </section>
      <section>
        <h2>{t("disclaimerNoPrivilegeHeading")}</h2>
        <p>{t("disclaimerNoPrivilegeBody")}</p>
      </section>
      <section>
        <h2>{t("disclaimerRelianceHeading")}</h2>
        <p>{t("disclaimerRelianceBody")}</p>
      </section>
      <section>
        <h2>{t("disclaimerLawyerReviewHeading")}</h2>
        <p>{t("disclaimerLawyerReviewBody")}</p>
      </section>
      <section>
        <h2>{t("disclaimerJurisdictionHeading")}</h2>
        <p>{t("disclaimerJurisdictionBody")}</p>
      </section>
      <section>
        <h2>{t("disclaimerRegulatoryHeading")}</h2>
        <p>{t("disclaimerRegulatoryBody")}</p>
      </section>
      <section>
        <h2>{t("disclaimerUserResponsibilitiesHeading")}</h2>
        <p>{t("disclaimerUserResponsibilitiesBody")}</p>
      </section>
      <section>
        <h2>{t("disclaimerNotProvideHeading")}</h2>
        <ul>
          <li>{t("disclaimerNotProvideAdvice")}</li>
          <li>{t("disclaimerNotProvideRepresentation")}</li>
          <li>{t("disclaimerNotProvideSubstitute")}</li>
          <li>{t("disclaimerNotProvidePrivilege")}</li>
          <li>{t("disclaimerNotProvideProfessional")}</li>
        </ul>
      </section>
    </PublicPolicyPage>
  )
}
