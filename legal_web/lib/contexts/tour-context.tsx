"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import type { DriveStep, Config } from "driver.js"
import "driver.js/dist/driver.css"
import "@/lib/tutorials/tutorials.css"
import { useAuth } from "@/lib/contexts/auth-context"
import { useRoleOptional } from "@/lib/contexts/role-context"
import {
  getToursForZone,
  resolveTourForPath,
  SHELL_TOUR,
} from "@/lib/tutorials/tour-registry"
import { getTourLabelKey } from "@/lib/tutorials/tour-labels"
import type {
  TourContextValue,
  TourDefinition,
  TutorialProgressMap,
} from "@/lib/tutorials/types"
import {
  getCachedTutorialProgress,
  mergeTutorialProgress,
  setCachedTutorialProgress,
} from "@/lib/tutorials/tour-progress"
import { getUserPreferences, patchTutorialProgress } from "@/lib/api/users"
import type { UserRole } from "@/lib/types/roles"
import { TourWelcomeDialog } from "@/components/tutorials/tour-welcome-dialog"

const TourContext = createContext<TourContextValue | undefined>(undefined)

const CONSUMER_ROLE: UserRole = "READ_ONLY"

function zoneFromPath(pathname: string): "lawyer" | "consumer" | null {
  if (pathname.startsWith("/app")) return "lawyer"
  if (pathname.startsWith("/consumer")) return "consumer"
  return null
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function waitForElement(selector: string, timeoutMs = 4000): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector)
    if (existing) {
      resolve(existing)
      return
    }
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector)
      if (el) {
        observer.disconnect()
        resolve(el)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => {
      observer.disconnect()
      resolve(document.querySelector(selector))
    }, timeoutMs)
  })
}

export function TourProvider({
  children,
  zone,
}: {
  children: React.ReactNode
  zone: "lawyer" | "consumer"
}) {
  const pathname = usePathname()
  const t = useTranslations("tutorials")
  const { user, isAuthenticated } = useAuth()
  const roleCtx = useRoleOptional()
  const role = zone === "consumer" ? CONSUMER_ROLE : (roleCtx?.currentRole ?? "PARTNER_ADMIN")

  const [progress, setProgress] = useState<TutorialProgressMap>({})
  const [isLoading, setIsLoading] = useState(true)
  const [activeTourId, setActiveTourId] = useState<string | null>(null)
  const [replayTourId, setReplayTourId] = useState<string | null>(null)
  const [helpPanelTourId, setHelpPanelTourId] = useState<string | null>(null)
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false)

  const driverRef = useRef<{ drive: () => void; destroy: () => void } | null>(null)
  const autoStartedRef = useRef<Set<string>>(new Set())
  const skippedRef = useRef(false)
  const activeTourRef = useRef<TourDefinition | null>(null)

  const tours = useMemo(() => getToursForZone(zone), [zone])
  const currentTour = useMemo(
    () => resolveTourForPath(tours, pathname, role),
    [tours, pathname, role],
  )
  const currentTourId = currentTour?.id ?? null

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setProgress({})
      setIsLoading(false)
      return
    }
    const cached = getCachedTutorialProgress(user.id)
    setProgress(cached)
    setIsLoading(true)
    getUserPreferences()
      .then((prefs) => {
        const remote = (prefs.tutorialProgress ?? {}) as TutorialProgressMap
        const merged = mergeTutorialProgress(cached, remote)
        setProgress(merged)
        setCachedTutorialProgress(user.id, merged)
      })
      .catch(() => {
        /* use cache only */
      })
      .finally(() => setIsLoading(false))
  }, [isAuthenticated, user?.id])

  const persistEntry = useCallback(
    async (
      tourId: string,
      entry: {
        completedAt?: string
        dismissedPanel?: boolean
        skipped?: boolean
        welcomeDismissed?: boolean
      },
    ) => {
      if (!user?.id) return
      const next = { ...progress, [tourId]: { ...progress[tourId], ...entry } }
      setProgress(next)
      setCachedTutorialProgress(user.id, next)
      try {
        await patchTutorialProgress(tourId, next[tourId]!)
      } catch {
        /* local cache retained */
      }
    },
    [progress, user?.id],
  )

  const isTourCompleted = useCallback(
    (tourId: string) => !!progress[tourId]?.completedAt,
    [progress],
  )

  const isHelpPanelDismissed = useCallback(
    (tourId: string) => !!progress[tourId]?.dismissedPanel,
    [progress],
  )

  const markTourSkipped = useCallback(
    (tourId: string) => {
      skippedRef.current = true
      driverRef.current?.destroy()
    },
    [],
  )

  const runDriverTour = useCallback(
    async (tour: TourDefinition, { force = false }: { force?: boolean } = {}): Promise<boolean> => {
      if (!force && isTourCompleted(tour.id)) return false

      // Resolve all elements in parallel (2s timeout each) to avoid sequential blocking
      const resolved = await Promise.all(
        tour.steps.map(async (step) => {
          const el = await waitForElement(step.element, 2000)
          return el ? step : null
        }),
      )

      const steps: DriveStep[] = resolved
        .filter((step): step is NonNullable<typeof step> => step !== null)
        .map((step) => ({
          element: step.element,
          popover: {
            title: t(step.titleKey),
            description: t(step.bodyKey),
            side: step.side ?? "bottom",
            align: "start",
          },
        }))

      if (steps.length === 0) return false

      driverRef.current?.destroy()
      skippedRef.current = false
      activeTourRef.current = tour
      setActiveTourId(tour.id)

      const tourLabel = t(getTourLabelKey(tour.id) as Parameters<typeof t>[0])

      const config: Config = {
        showProgress: true,
        animate: !prefersReducedMotion(),
        overlayOpacity: 0.38,
        stagePadding: 10,
        stageRadius: 12,
        allowClose: true,
        popoverClass: "umbrella-tour-popover",
        // next-intl requires ICU values; driver.js substitutes {{current}}/{{total}} at runtime
        progressText: t("controls.progress", {
          current: "{{current}}",
          total: "{{total}}",
        }),
        nextBtnText: t("controls.next"),
        prevBtnText: t("controls.back"),
        doneBtnText: t("controls.done"),
        showButtons: ["previous", "next", "close"],
        onCloseClick: () => {
          skippedRef.current = true
          driverRef.current?.destroy()
        },
        onPopoverRender: (popover) => {
          if (popover.wrapper.querySelector(".umbrella-tour-popover-brand")) return

          const brand = document.createElement("div")
          brand.className = "umbrella-tour-popover-brand"
          brand.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg><span>${tourLabel}</span>`
          popover.wrapper.insertBefore(brand, popover.wrapper.firstChild)

          const skipBtn = document.createElement("button")
          skipBtn.type = "button"
          skipBtn.className = "umbrella-tour-skip-link"
          skipBtn.textContent = t("controls.skipTour")
          skipBtn.addEventListener("click", () => markTourSkipped(tour.id))
          popover.footer.insertBefore(skipBtn, popover.footer.firstChild)
        },
        onDestroyed: () => {
          const finishedTour = activeTourRef.current
          setActiveTourId(null)
          setReplayTourId(null)
          activeTourRef.current = null
          if (finishedTour) {
            void persistEntry(finishedTour.id, {
              completedAt: new Date().toISOString(),
              skipped: skippedRef.current,
            })
          }
          skippedRef.current = false
        },
        steps,
      }

      const { driver } = await import("driver.js")
      const d = driver(config)
      driverRef.current = d
      d.drive()
      return true
    },
    [isTourCompleted, markTourSkipped, persistEntry, t],
  )

  const startTour = useCallback(
    (tourId: string, options?: { force?: boolean }) => {
      const tour =
        tourId === SHELL_TOUR.id
          ? SHELL_TOUR
          : tours.find((item) => item.id === tourId)
      if (tour) void runDriverTour(tour, options)
    },
    [runDriverTour, tours],
  )

  const replayCurrentTour = useCallback(() => {
    if (currentTour) {
      setReplayTourId(currentTour.id)
      void runDriverTour(currentTour, { force: true })
    }
  }, [currentTour, runDriverTour])

  const markTourCompleted = useCallback(
    (tourId: string, skipped = false) => {
      void persistEntry(tourId, {
        completedAt: new Date().toISOString(),
        skipped,
      })
    },
    [persistEntry],
  )

  const dismissHelpPanel = useCallback(
    (tourId: string) => {
      void persistEntry(tourId, { dismissedPanel: true })
      setHelpPanelTourId(null)
    },
    [persistEntry],
  )

  const openHelpPanel = useCallback(() => {
    if (currentTourId) setHelpPanelTourId(currentTourId)
  }, [currentTourId])

  const closeHelpPanel = useCallback(() => setHelpPanelTourId(null), [])

  const dismissWelcome = useCallback(() => {
    void persistEntry(SHELL_TOUR.id, { welcomeDismissed: true })
    setShowWelcomeDialog(false)
  }, [persistEntry])

  const startWelcomeTour = useCallback(() => {
    void persistEntry(SHELL_TOUR.id, { welcomeDismissed: true })
    setShowWelcomeDialog(false)
    startTour(SHELL_TOUR.id)
  }, [persistEntry, startTour])

  const skipWelcomeTour = useCallback(() => {
    void persistEntry(SHELL_TOUR.id, {
      welcomeDismissed: true,
      completedAt: new Date().toISOString(),
      skipped: true,
    })
    setShowWelcomeDialog(false)
  }, [persistEntry])

  // Show welcome modal on first dashboard visit (lawyer zone)
  useEffect(() => {
    if (zone !== "lawyer" || pathname !== "/app/dashboard" || isLoading) return
    if (isTourCompleted(SHELL_TOUR.id)) return
    if (progress[SHELL_TOUR.id]?.welcomeDismissed) return
    setShowWelcomeDialog(true)
  }, [isLoading, isTourCompleted, pathname, progress, zone])

  // Auto-start page tours after navigation
  useEffect(() => {
    if (isLoading || !currentTour?.autoStart || activeTourId) return
    if (currentTour.id === SHELL_TOUR.id) return
    if (isTourCompleted(currentTour.id)) return
    if (autoStartedRef.current.has(currentTour.id)) return

    if (pathname === "/app/dashboard" && !isTourCompleted(SHELL_TOUR.id)) {
      return
    }

    autoStartedRef.current.add(currentTour.id)
    const timer = setTimeout(() => {
      void runDriverTour(currentTour).then((started) => {
        if (!started) autoStartedRef.current.delete(currentTour.id)
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [
    activeTourId,
    currentTour,
    isLoading,
    isTourCompleted,
    pathname,
    runDriverTour,
  ])

  // Chain shell tour → dashboard tour on first visit
  useEffect(() => {
    if (zone !== "lawyer" || pathname !== "/app/dashboard" || isLoading) return
    if (!isTourCompleted(SHELL_TOUR.id) || isTourCompleted("app.dashboard")) return
    if (autoStartedRef.current.has("app.dashboard-chained")) return
    autoStartedRef.current.add("app.dashboard-chained")
    const dashboardTour = tours.find((item) => item.id === "app.dashboard")
    if (dashboardTour && !activeTourId) {
      const timer = setTimeout(() => void runDriverTour(dashboardTour), 600)
      return () => clearTimeout(timer)
    }
  }, [
    activeTourId,
    isLoading,
    isTourCompleted,
    pathname,
    runDriverTour,
    tours,
    zone,
  ])

  const value: TourContextValue = {
    zone,
    progress,
    isLoading,
    activeTourId,
    replayTourId,
    helpPanelTourId,
    showWelcomeDialog,
    currentTourId,
    currentTour,
    startTour,
    replayCurrentTour,
    openHelpPanel,
    closeHelpPanel,
    markTourCompleted,
    dismissHelpPanel,
    dismissWelcome,
    startWelcomeTour,
    skipWelcomeTour,
    isTourCompleted,
    isHelpPanelDismissed,
  }

  return (
    <TourContext.Provider value={value}>
      {children}
      {zone === "lawyer" ? (
        <TourWelcomeDialog
          open={showWelcomeDialog}
          onOpenChange={(open) => {
            if (!open) dismissWelcome()
            else setShowWelcomeDialog(true)
          }}
        />
      ) : null}
    </TourContext.Provider>
  )
}

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) {
    throw new Error("useTour must be used within TourProvider")
  }
  return ctx
}

/** Safe hook when tour provider may be absent */
export function useTourOptional() {
  return useContext(TourContext)
}

export { zoneFromPath }
