import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { PublicPolicyPage } from "@/components/legal/public-policy-page"
import { DeleteAccountForm } from "@/components/legal/delete-account-form"
import { buildPageMetadata, SITE_NAME } from "@/lib/seo/site-metadata"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal")
  return buildPageMetadata(
    {
      title: t("deleteAccountTitle"),
      description: t("deleteAccountDescription"),
      path: "/deleteaccount",
    },
    SITE_NAME,
  )
}

export default async function DeleteAccountPage() {
  const t = await getTranslations("legal")

  return (
    <PublicPolicyPage
      title={t("deleteAccountTitle")}
      description={t("deleteAccountDescription")}
      homeLabel={t("policyHome")}
    >
      <section>
        <p className="font-medium">{t("deleteAccountAppName")}</p>
        <p className="text-muted-foreground">{t("deleteAccountOperator")}</p>
      </section>

      <section>
        <h2>{t("deleteAccountStepsHeading")}</h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>{t("deleteAccountStep1")}</li>
          <li>{t("deleteAccountStep2")}</li>
          <li>{t("deleteAccountStep3")}</li>
          <li>{t("deleteAccountStep4")}</li>
        </ol>
      </section>

      <section>
        <DeleteAccountForm />
      </section>

      <section>
        <h2>{t("deleteAccountDeletedHeading")}</h2>
        <p>{t("deleteAccountDeletedBody")}</p>
      </section>

      <section>
        <h2>{t("deleteAccountRetainedHeading")}</h2>
        <p>{t("deleteAccountRetainedBody")}</p>
      </section>

      <section>
        <h2>{t("deleteAccountRetentionHeading")}</h2>
        <p>{t("deleteAccountRetentionBody")}</p>
      </section>

      <section>
        <h2>{t("deleteAccountPartialHeading")}</h2>
        <p>{t("deleteAccountPartialBody")}</p>
      </section>

      <section>
        <h2>{t("deleteAccountFirmHeading")}</h2>
        <p>{t("deleteAccountFirmBody")}</p>
      </section>

      <section>
        <h2>{t("deleteAccountContactHeading")}</h2>
        <p>{t("deleteAccountContactBody")}</p>
        <p>
          <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
            {t("deleteAccountPrivacyLink")}
          </Link>
        </p>
      </section>
    </PublicPolicyPage>
  )
}
