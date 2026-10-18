import type { UserRole } from "@/lib/types/roles"

export interface TutorialProgressEntry {
  completedAt?: string
  dismissedPanel?: boolean
  skipped?: boolean
  welcomeDismissed?: boolean
}

export type TutorialProgressMap = Record<string, TutorialProgressEntry>

export interface TourStepDef {
  /** CSS selector, typically [data-tour=...] */
  element: string
  titleKey: string
  bodyKey: string
  /** Optional side for driver popover */
  side?: "top" | "bottom" | "left" | "right"
}

export interface TourHelpPanelDef {
  titleKey: string
  bullets: string[]
}

export interface TourDefinition {
  id: string
  /** Route patterns — exact or prefix (trailing * for dynamic segments) */
  routes: string[]
  /** If set, tour only applies when user role is in list */
  roles?: UserRole[]
  autoStart?: boolean
  steps: TourStepDef[]
  helpPanel?: TourHelpPanelDef
}

export interface TourContextValue {
  zone: "lawyer" | "consumer"
  progress: TutorialProgressMap
  isLoading: boolean
  activeTourId: string | null
  replayTourId: string | null
  helpPanelTourId: string | null
  showWelcomeDialog: boolean
  /** Current page tour id resolved from pathname */
  currentTourId: string | null
  currentTour: TourDefinition | null
  startTour: (tourId: string, options?: { force?: boolean }) => void
  replayCurrentTour: () => void
  openHelpPanel: () => void
  closeHelpPanel: () => void
  markTourCompleted: (tourId: string, skipped?: boolean) => void
  dismissHelpPanel: (tourId: string) => void
  dismissWelcome: () => void
  startWelcomeTour: () => void
  skipWelcomeTour: () => void
  isTourCompleted: (tourId: string) => boolean
  isHelpPanelDismissed: (tourId: string) => boolean
}
