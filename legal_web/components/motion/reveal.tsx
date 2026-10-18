"use client"

import { motion, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"

/**
 * `mount` animates immediately on render (safe for above-the-fold hero content,
 * where relying on an IntersectionObserver-driven `whileInView` can occasionally
 * leave elements stuck at opacity 0 across fast client-side transitions).
 * `inView` defers the reveal until the element scrolls into the viewport.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  mode = "inView",
}: {
  children: ReactNode
  delay?: number
  className?: string
  mode?: "inView" | "mount"
}) {
  const reduceMotion = useReducedMotion()
  const hidden = { opacity: 0, y: 18 }
  const shown = { opacity: 1, y: 0 }
  const transition = { duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] as const }

  if (mode === "mount") {
    return (
      <motion.div
        className={className}
        initial={reduceMotion ? false : hidden}
        animate={reduceMotion ? undefined : shown}
        transition={transition}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : hidden}
      whileInView={reduceMotion ? undefined : shown}
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -80px 0px" }}
      transition={transition}
    >
      {children}
    </motion.div>
  )
}
