"use client"

import { useLayoutEffect, type RefObject } from "react"

interface UseAutoResizeTextareaOptions {
  minHeight?: number
  maxHeight?: number
}

export function useAutoResizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  { minHeight = 140, maxHeight = 420 }: UseAutoResizeTextareaOptions = {},
) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    el.style.height = "auto"
    const nextHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)
    el.style.height = `${nextHeight}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden"
  }, [ref, value, minHeight, maxHeight])
}
