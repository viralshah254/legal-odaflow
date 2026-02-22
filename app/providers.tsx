"use client"

import { ThemeProvider } from "next-themes"
import { RoleProvider } from "@/lib/contexts/role-context"
import { CurrencyProvider } from "@/lib/contexts/currency-context"
import { PricingProvider } from "@/lib/contexts/pricing-context"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <CurrencyProvider>
        <PricingProvider>
          <RoleProvider>{children}</RoleProvider>
        </PricingProvider>
      </CurrencyProvider>
    </ThemeProvider>
  )
}

