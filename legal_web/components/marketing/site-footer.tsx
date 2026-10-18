"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { UmbrellaLogo } from "@/components/brand/umbrella-logo"
import { cn } from "@/lib/utils"

interface SiteFooterProps {
  className?: string
}

export function SiteFooter({ className }: SiteFooterProps) {
  const t = useTranslations("marketing.footer")

  return (
    <footer
      className={cn(
        "border-t border-border/40 bg-muted/20 py-12 sm:py-16 w-full",
        className,
      )}
    >
      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl w-full">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-8">
          <div className="lg:col-span-1">
            <UmbrellaLogo height={32} className="mb-4 group-hover:opacity-90 transition-opacity" />
            <p className="text-sm text-muted-foreground">{t("tagline")}</p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">{t("forConsumers")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/legal-issue-checker" className="hover:text-foreground transition-colors">
                  {t("legalIssueChecker")}
                </Link>
              </li>
              <li>
                <Link href="/legal-ai" className="hover:text-foreground transition-colors">
                  {t("legalAi")}
                </Link>
              </li>
              <li>
                <Link href="/solutions" className="hover:text-foreground transition-colors">
                  {t("solutions")}
                </Link>
              </li>
              <li>
                <Link href="/legal-guides" className="hover:text-foreground transition-colors">
                  {t("legalGuides")}
                </Link>
              </li>
              <li>
                <Link href="/upload-document" className="hover:text-foreground transition-colors">
                  {t("uploadDocument")}
                </Link>
              </li>
              <li>
                <Link href="/lawyers" className="hover:text-foreground transition-colors">
                  {t("findLawyer")}
                </Link>
              </li>
              <li>
                <Link href="/compare" className="hover:text-foreground transition-colors">
                  {t("compare")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">{t("regions")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/in" className="hover:text-foreground transition-colors">
                  {t("legalAiIndia")}
                </Link>
              </li>
              <li>
                <Link href="/gb" className="hover:text-foreground transition-colors">
                  {t("legalAiUK")}
                </Link>
              </li>
              <li>
                <Link href="/us" className="hover:text-foreground transition-colors">
                  {t("legalAiUS")}
                </Link>
              </li>
              <li>
                <Link href="/ke" className="hover:text-foreground transition-colors">
                  {t("legalAiKenya")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">{t("forLawyers")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/for-lawyers" className="hover:text-foreground transition-colors">
                  {t("lawyerPlatform")}
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-foreground transition-colors">
                  {t("pricing")}
                </Link>
              </li>
              <li>
                <Link href="/auth" className="hover:text-foreground transition-colors">
                  {t("startFreeTrial")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">{t("legal")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/privacy" className="hover:text-foreground transition-colors">
                  {t("privacy")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-foreground transition-colors">
                  {t("terms")}
                </Link>
              </li>
              <li>
                <Link href="/data-consent" className="hover:text-foreground transition-colors">
                  {t("dataConsent")}
                </Link>
              </li>
              <li>
                <Link href="/legal-disclaimer" className="hover:text-foreground transition-colors">
                  {t("legalDisclaimer")}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/40 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            {t("copyright", { year: new Date().getFullYear() })}
          </p>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-4">
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("pricing")}
            </Link>
            <Link href="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("signIn")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
