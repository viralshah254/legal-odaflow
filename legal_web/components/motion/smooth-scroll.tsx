"use client"

import { useEffect } from "react"
import { useReducedMotion } from "framer-motion"

export function SmoothScroll() {
  const reducedMotion = useReducedMotion()
  useEffect(() => {
    const root = document.documentElement
    if (reducedMotion || root.dataset.a11yReduceMotion === "true") return
    let destroyed = false
    let raf = 0
    let lenis: { raf: (time: number) => void; destroy: () => void } | undefined
    const previousScrollBehavior = root.style.scrollBehavior
    root.style.scrollBehavior = "auto"
    import("lenis").then(({ default: Lenis }) => {
      if (destroyed) return
      lenis = new Lenis({ duration: 1.05, smoothWheel: true })
      const frame = (time: number) => { lenis?.raf(time); raf = requestAnimationFrame(frame) }
      raf = requestAnimationFrame(frame)
    })
    return () => { destroyed = true; cancelAnimationFrame(raf); lenis?.destroy(); root.style.scrollBehavior = previousScrollBehavior }
  }, [reducedMotion])
  return null
}
