"use client"

import { useCallback, useRef, useState } from "react"
import type { WidgetPosition } from "./types"
import { clampWidgetToViewport, VIEWPORT_PADDING } from "./clamp-widget-bounds"

interface UseDraggablePositionOptions {
  position: WidgetPosition
  onPositionChange: (position: WidgetPosition) => void
  elementRef: React.RefObject<HTMLElement | null>
}

export function useDraggablePosition({
  position,
  onPositionChange,
  elementRef,
}: UseDraggablePositionOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const getPositionStyle = useCallback((): React.CSSProperties => {
    return {
      left: position.x,
      top: position.y,
      right: "auto",
      bottom: "auto",
    }
  }, [position])

  const clampPosition = useCallback(
    (x: number, y: number): WidgetPosition => {
      const el = elementRef.current
      if (!el) {
        return {
          x: Math.max(VIEWPORT_PADDING, x),
          y: Math.max(VIEWPORT_PADDING, y),
        }
      }
      return clampWidgetToViewport(el, x, y)
    },
    [elementRef],
  )

  const onDragStart = useCallback(
    (clientX: number, clientY: number) => {
      const el = elementRef.current
      if (!el) return

      const rect = el.getBoundingClientRect()
      dragOffset.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      }
      setIsDragging(true)
    },
    [elementRef],
  )

  const onDragMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging) return
      const next = clampPosition(
        clientX - dragOffset.current.x,
        clientY - dragOffset.current.y,
      )
      onPositionChange(next)
    },
    [isDragging, clampPosition, onPositionChange],
  )

  const onDragEnd = useCallback(() => {
    setIsDragging(false)
    const el = elementRef.current
    if (el) {
      const rect = el.getBoundingClientRect()
      onPositionChange(clampWidgetToViewport(el, rect.left, rect.top))
    }
  }, [elementRef, onPositionChange])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      onDragStart(e.clientX, e.clientY)
    },
    [onDragStart],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      onDragMove(e.clientX, e.clientY)
    },
    [isDragging, onDragMove],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      e.currentTarget.releasePointerCapture(e.pointerId)
      onDragEnd()
    },
    [isDragging, onDragEnd],
  )

  return {
    isDragging,
    getPositionStyle,
    dragHandleProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    },
  }
}
