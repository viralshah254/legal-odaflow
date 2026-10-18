"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Check, Sparkles, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { trackLandingCtaClick } from "@/lib/analytics/posthog"

interface MobileGuestSignupSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileGuestSignupSheet({
  open,
  onOpenChange,
}: MobileGuestSignupSheetProps) {
  const t = useTranslations("marketing.home.guestSignup")

  return (
    <Sheet open={open} onOpenChange={() => {}}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        dismissible={false}
        className="rounded-t-2xl max-h-[85dvh] border-t border-primary/20 pb-safe-bottom overflow-hidden"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-6 bottom-24 h-24 w-24 rounded-full bg-violet-500/10 blur-2xl"
        />

        <SheetHeader className="relative mb-5 text-left space-y-4 pr-8">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-primary via-primary to-violet-600 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-white/20">
            <Sparkles className="h-3.5 w-3.5 shrink-0 animate-pulse" />
            <span>{t("badge")}</span>
            <Zap className="h-3.5 w-3.5 shrink-0 fill-current" />
          </div>

          <div className="space-y-2">
            <SheetTitle className="text-xl leading-tight">{t("title")}</SheetTitle>
            <SheetDescription className="text-sm leading-relaxed">
              {t("description")}
            </SheetDescription>
          </div>

          <ul className="grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {(["perkCredits", "perkSave", "perkPrivate", "perkNoTraining"] as const).map(
              (key) => (
                <li key={key} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                  {t(key)}
                </li>
              ),
            )}
          </ul>
        </SheetHeader>

        <div className="relative flex flex-col gap-2 pb-2">
          <Button asChild className="w-full shadow-md shadow-primary/20" size="lg">
            <Link
              href="/auth/sign-up"
              onClick={() =>
                trackLandingCtaClick({
                  cta: "guest_signup_sheet_signup",
                  location: "mobile_guest_sheet",
                })
              }
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {t("signUp")}
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            size="lg"
            onClick={() => {
              trackLandingCtaClick({
                cta: "guest_signup_sheet_continue_guest",
                location: "mobile_guest_sheet",
              })
              onOpenChange(false)
            }}
          >
            {t("continueAsGuest")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
