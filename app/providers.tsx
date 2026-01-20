"use client"

import { ThemeProvider } from "next-themes"
import { RoleProvider } from "@/lib/contexts/role-context"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <RoleProvider>{children}</RoleProvider>
    </ThemeProvider>
  )
}

