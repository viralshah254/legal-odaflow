"use client"

import { Suspense } from "react"
import { ThemeProvider } from "next-themes"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { RoleProvider } from "@/lib/contexts/role-context"
import { CurrencyProvider } from "@/lib/contexts/currency-context"
import { PricingProvider } from "@/lib/contexts/pricing-context"
import { AuthProvider } from "@/lib/contexts/auth-context"
import { CountryProvider } from "@/lib/contexts/country-context"
import { LocaleProvider } from "@/lib/contexts/locale-context"
import { TenantProvider } from "@/lib/contexts/tenant-context"
import { ReferralCapture } from "@/components/referrals/referral-capture"
import { SiteAnalyticsTracker } from "@/components/analytics/site-analytics-tracker"
import { OAuthRedirectBootstrap } from "@/components/auth/oauth-redirect-bootstrap"

export function Providers({
  children,
  initialLocale,
}: {
  children: React.ReactNode
  initialLocale: string
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TenantProvider>
            <CountryProvider>
              <LocaleProvider initialLocale={initialLocale}>
                <CurrencyProvider>
                  <PricingProvider>
                    <RoleProvider>
                      {children}
                      <Suspense>
                        <ReferralCapture />
                      </Suspense>
                      <Suspense>
                        <OAuthRedirectBootstrap />
                      </Suspense>
                      <Suspense>
                        <SiteAnalyticsTracker />
                      </Suspense>
                    </RoleProvider>
                  </PricingProvider>
                </CurrencyProvider>
              </LocaleProvider>
            </CountryProvider>
          </TenantProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
