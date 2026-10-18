"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RoleGate } from "@/components/dashboard/role-gate"
import { PageEnter } from "@/components/ui/motion"
import {
  ArrowRight,
  CreditCard,
  FileText,
  Receipt,
  Wallet,
} from "lucide-react"

export default function BillingPage() {
  const t = useTranslations("billing")

  const billingLinks = [
    {
      title: t("billing_link_subscription_title"),
      description: t("billing_link_subscription_description"),
      href: "/app/settings/billing",
      icon: CreditCard,
    },
    {
      title: t("invoices"),
      description: t("billing_link_invoices_description"),
      href: "/app/accounting/invoices",
      icon: FileText,
    },
    {
      title: t("billing_link_prebill_title"),
      description: t("billing_link_prebill_description"),
      href: "/app/billing/pre-bill",
      icon: Receipt,
    },
    {
      title: t("billing_link_payments_title"),
      description: t("billing_link_payments_description"),
      href: "/app/accounting/payments",
      icon: Wallet,
    },
    {
      title: t("statements"),
      description: t("billing_link_statements_description"),
      href: "/app/accounting/statements",
      icon: Receipt,
    },
    {
      title: t("finance_dashboard"),
      description: t("billing_link_finance_description"),
      href: "/app/finance",
      icon: Wallet,
    },
  ]

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN", "FINANCE"]}>
      <PageEnter className="p-6 space-y-6">
        <div data-tour="billing-header">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("billing_hub_subtitle")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2" data-tour="billing-links">
          {billingLinks.map((item) => {
            const Icon = item.icon
            return (
              <Card key={item.href} className="shadow-token-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </div>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <Link href={item.href}>
                      {t("open")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </PageEnter>
    </RoleGate>
  )
}
