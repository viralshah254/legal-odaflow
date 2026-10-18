import type { WidgetPosition } from "./types"

export const VIEWPORT_PADDING = 12

/** Clamp top-left coords so the full widget element stays inside the viewport. */
export function clampWidgetToViewport(
  el: HTMLElement,
  x: number,
  y: number,
  padding = VIEWPORT_PADDING,
): WidgetPosition {
  const width = el.offsetWidth || el.getBoundingClientRect().width || 56
  const height = el.offsetHeight || el.getBoundingClientRect().height || 56

  const maxX = Math.max(padding, window.innerWidth - width - padding)
  const maxY = Math.max(padding, window.innerHeight - height - padding)

  return {
    x: Math.min(Math.max(padding, x), maxX),
    y: Math.min(Math.max(padding, y), maxY),
  }
}

/** Default bottom-left placement for the launcher + panel container. */
export function getDefaultWidgetPosition(el: HTMLElement): WidgetPosition {
  const height = el.offsetHeight || 56
  return clampWidgetToViewport(
    el,
    VIEWPORT_PADDING + 12,
    window.innerHeight - height - VIEWPORT_PADDING - 12,
  )
}

/** Legacy positions used negative y as "distance from bottom". Convert to absolute top. */
export function normalizeStoredPosition(
  position: WidgetPosition,
  el: HTMLElement,
): WidgetPosition {
  if (position.y < 0 || position.x < 0) {
    const width = el.offsetWidth || 56
    const height = el.offsetHeight || 56
    const x =
      position.x >= 0
        ? position.x
        : window.innerWidth + position.x - width
    const y =
      position.y >= 0
        ? position.y
        : window.innerHeight + position.y - height
    return clampWidgetToViewport(el, x, y)
  }
  return clampWidgetToViewport(el, position.x, position.y)
}

/** True when the launcher sits in the lower half — panel should open upward. */
export function shouldPanelOpenUpward(y: number, el: HTMLElement): boolean {
  const launcherY = y + (el.offsetHeight || 0) - 48
  return launcherY > window.innerHeight / 2
}
