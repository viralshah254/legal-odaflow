"use client"

import { Suspense, useEffect } from "react"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import dynamic from "next/dynamic"
import { CommandPalette } from "@/components/command-palette"
import { CopilotContextSyncer } from "@/components/copilot/copilot-context-syncer"
import { GlobalRecordMeeting } from "@/components/meetings/global-record-meeting"

const CopilotDrawer = dynamic(
  () => import("@/components/copilot/copilot-drawer").then((m) => ({ default: m.CopilotDrawer })),
  { ssr: false, loading: () => null },
)
import { useMeetingRecordingStore } from "@/lib/store/meeting-recording-store"
import { Toaster } from "@/components/ui/toaster"
import { RoleProvider } from "@/lib/contexts/role-context"
import { CopilotProvider } from "@/lib/contexts/copilot-context"
import { RealtimeProvider } from "@/lib/contexts/realtime-context"
import { AppUserBridge } from "@/lib/auth/app-user-bridge"
import { CopilotFloatingButton } from "@/components/copilot/copilot-floating-button"
import { TourProvider } from "@/lib/contexts/tour-context"
import { PageHelpPanel } from "@/components/tutorials/page-help-panel"
import { IntroOfferProvider } from "@/components/marketing/intro-offer-provider"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { AiModelProvider } from "@/lib/contexts/ai-model-context"

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const t = useTranslations("lawyer")
  const pathname = usePathname()
  // Only the matter document workspace manages its own internal scroll panes.
  // Standalone drafting flows (India/US) need normal page scrolling.
  const isImmersivePage = /\/matters\/[^/]+\/draft\/?$/.test(pathname)
  const isRecording = useMeetingRecordingStore((s) => s.activeMeeting != null)
  usePushNotifications()

  useEffect(() => {
    document.documentElement.classList.add("app-shell")
    return () => {
      document.documentElement.classList.remove("app-shell")
    }
  }, [])

  const mainClassName = isImmersivePage
    ? "min-h-0 flex-1 overflow-hidden bg-[hsl(var(--surface))]"
    : `min-h-0 flex-1 bg-[hsl(var(--surface))]${isRecording ? " pb-24" : ""}`

  return (
    <>
      <div className="fixed inset-0 z-0 flex overflow-hidden bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:top-4 focus:left-4 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {t("skipToContent")}
        </a>
        <CopilotContextSyncer />
        <AppSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <AppTopbar />
          <main
            id="main-content"
            className={isImmersivePage ? mainClassName : `app-scroll-pane ${mainClassName}`}
            tabIndex={-1}
          >
            {!isImmersivePage && (
              <div className="px-4 sm:px-6 pt-4 max-w-[1600px]">
                <PageHelpPanel />
              </div>
            )}
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </main>
        </div>
      </div>
      <CommandPalette />
      <CopilotDrawer />
      <CopilotFloatingButton />
      <GlobalRecordMeeting />
      <Toaster />
    </>
  )
}

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useTranslations("common")
  void t
  return (
    <RoleProvider>
      <CopilotProvider>
        <RealtimeProvider>
          <AppUserBridge>
            <AiModelProvider>
              <TourProvider zone="lawyer">
                <AppLayoutContent>{children}</AppLayoutContent>
                <IntroOfferProvider />
              </TourProvider>
            </AiModelProvider>
          </AppUserBridge>
        </RealtimeProvider>
      </CopilotProvider>
    </RoleProvider>
  )
}
