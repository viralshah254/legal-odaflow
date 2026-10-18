"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/lib/contexts/auth-context"
import { CreditBalanceWidget } from "@/components/consumer/credit-balance-widget"
import { LogOut } from "lucide-react"
import { LanguageSettingsCard } from "@/components/settings/language-settings-card"
import { useTranslations } from "next-intl"

export default function ConsumerSettingsPage() {
  const tCommon = useTranslations("common")
  const tAdmin = useTranslations("admin")
  const { user, logout } = useAuth()
  const t = useTranslations("settings")
  const tc = useTranslations("common")

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-2xl w-full">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t("title")}</h1>
        <p className="text-muted-foreground mb-8">{t("accountSettings")}</p>

        {user && (
          <div className="mb-6">
            <CreditBalanceWidget />
          </div>
        )}

        <div data-tour="consumer-settings-hub">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{tCommon("profile")}</CardTitle>
            <CardDescription>{t("your_account_information")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{tAdmin("email")}</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{tAdmin("name")}</Label>
              <Input id="name" value={user?.name ?? ""} disabled placeholder={t("not_set")} />
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("country")}</Label>
              <Select value={user?.countryCode ?? "IN"} disabled>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">{tCommon("india")}</SelectItem>
                  <SelectItem value="US">{tCommon("united_states")}</SelectItem>
                  <SelectItem value="KE">{tCommon("kenya")}</SelectItem>
                  <SelectItem value="GB">{tCommon("united_kingdom")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="mb-6">
          <LanguageSettingsCard />
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("data_consent")}</CardTitle>
            <CardDescription>{t("control_training_opt-in_and_data_use_default_off")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/consumer/settings/data-consent">
              <Button variant="outline">{t("manage_data_consent")}</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("account_actions")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/consumer/dashboard">
              <Button variant="outline" className="w-full sm:w-auto">{t("back_to_dashboard")}</Button>
            </Link>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={() => logout()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {tc("signOut")}
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  )
}
