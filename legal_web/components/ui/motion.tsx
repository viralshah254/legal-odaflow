"use client"

import { useEffect, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return reduced
}

interface PageEnterProps {
  children: ReactNode
  className?: string
}

/** Fade + slide page entry — respects prefers-reduced-motion */
export function PageEnter({ children, className }: PageEnterProps) {
  const reduced = usePrefersReducedMotion()
  return (
    <div
      className={cn(!reduced && "motion-page-enter", className)}
      data-reduced-motion={reduced ? "true" : "false"}
    >
      {children}
    </div>
  )
}

interface StaggerListProps {
  children: ReactNode
  className?: string
}

/** Stagger children with CSS animation delays */
export function StaggerList({ children, className }: StaggerListProps) {
  const reduced = usePrefersReducedMotion()
  return (
    <div
      className={cn(!reduced && "motion-stagger-list", className)}
      data-reduced-motion={reduced ? "true" : "false"}
    >
      {children}
    </div>
  )
}

interface TabPanelMotionProps {
  children: ReactNode
  className?: string
  value: string
  activeValue: string
}

/** Tab panel fade transition */
export function TabPanelMotion({ children, className, value, activeValue }: TabPanelMotionProps) {
  const reduced = usePrefersReducedMotion()
  if (value !== activeValue) return null
  return (
    <div
      className={cn(!reduced && "motion-tab-enter", className)}
      role="tabpanel"
      data-reduced-motion={reduced ? "true" : "false"}
    >
      {children}
    </div>
  )
}
