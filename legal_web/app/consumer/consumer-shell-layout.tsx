"use client"

import { Suspense, useEffect } from "react"
import { ConsumerUserBridge } from "@/lib/auth/consumer-user-bridge"
import { TourProvider } from "@/lib/contexts/tour-context"
import { PageHelpPanel } from "@/components/tutorials/page-help-panel"
import { IntroOfferProvider } from "@/components/marketing/intro-offer-provider"
import { ConsumerSidebar } from "@/components/consumer/consumer-sidebar"
import { ConsumerTopbar } from "@/components/consumer/consumer-topbar"
import { AiModelProvider } from "@/lib/contexts/ai-model-context"
import { CopilotProvider } from "@/lib/contexts/copilot-context"
import { Toaster } from "@/components/ui/toaster"

function ConsumerShellContent({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("app-shell")
    return () => {
      document.documentElement.classList.remove("app-shell")
    }
  }, [])

  return (
    <>
      <div className="fixed inset-0 z-0 flex overflow-hidden bg-background">
        <ConsumerSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ConsumerTopbar />
          <div className="shrink-0 px-4 sm:px-6 pt-4 max-w-7xl w-full mx-auto">
            <PageHelpPanel />
          </div>
          <main className="app-scroll-pane min-h-0 flex-1">
            <Suspense fallback={null}>{children}</Suspense>
          </main>
        </div>
      </div>
      <Toaster />
    </>
  )
}

export default function ConsumerShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConsumerUserBridge>
      <CopilotProvider>
        <AiModelProvider>
          <TourProvider zone="consumer">
            <ConsumerShellContent>{children}</ConsumerShellContent>
            <IntroOfferProvider />
          </TourProvider>
        </AiModelProvider>
      </CopilotProvider>
    </ConsumerUserBridge>
  )
}
