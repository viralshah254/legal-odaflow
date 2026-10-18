import type { AccessibilitySettings } from "./types"

const A11Y_ATTR_PREFIX = "data-a11y-"

export function applyAccessibilitySettings(settings: AccessibilitySettings): void {
  if (typeof document === "undefined") return

  const html = document.documentElement
  clearA11yAttributes(html)

  if (settings.smartContrast) {
    html.setAttribute(`${A11Y_ATTR_PREFIX}smart-contrast`, "true")
  }
  if (settings.pauseAnimations) {
    html.setAttribute(`${A11Y_ATTR_PREFIX}reduce-motion`, "true")
  }
  if (settings.screenReaderEnhancements) {
    html.setAttribute(`${A11Y_ATTR_PREFIX}screen-reader`, "true")
  }
  if (settings.highContrast) {
    html.setAttribute(`${A11Y_ATTR_PREFIX}high-contrast`, "true")
  }
  if (settings.highlightLinks) {
    html.setAttribute(`${A11Y_ATTR_PREFIX}highlight-links`, "true")
  }
  if (settings.textScale > 0) {
    html.setAttribute(`${A11Y_ATTR_PREFIX}text-scale`, String(settings.textScale))
  }
  if (settings.textSpacing) {
    html.setAttribute(`${A11Y_ATTR_PREFIX}text-spacing`, "true")
  }
  if (settings.hideImages) {
    html.setAttribute(`${A11Y_ATTR_PREFIX}hide-images`, "true")
  }
  if (settings.dyslexiaFont) {
    html.setAttribute(`${A11Y_ATTR_PREFIX}dyslexia-font`, "true")
  }
  if (settings.largeCursor) {
    html.setAttribute(`${A11Y_ATTR_PREFIX}large-cursor`, "true")
  }
  if (settings.tooltips) {
    html.setAttribute(`${A11Y_ATTR_PREFIX}tooltips`, "true")
  }
  if (settings.pageStructure) {
    html.setAttribute(`${A11Y_ATTR_PREFIX}page-structure`, "true")
  }
  if (settings.lineHeight > 0) {
    html.setAttribute(`${A11Y_ATTR_PREFIX}line-height`, String(settings.lineHeight))
  }
  if (settings.textAlign !== "default") {
    html.setAttribute(`${A11Y_ATTR_PREFIX}text-align`, settings.textAlign)
  }
  if (settings.dictionary) {
    html.setAttribute(`${A11Y_ATTR_PREFIX}dictionary`, "true")
  }
  if (settings.saturation !== "normal") {
    html.setAttribute(`${A11Y_ATTR_PREFIX}saturation`, settings.saturation)
  }
}

function clearA11yAttributes(html: HTMLElement): void {
  const toRemove: string[] = []
  for (const attr of html.attributes) {
    if (attr.name.startsWith(A11Y_ATTR_PREFIX)) {
      toRemove.push(attr.name)
    }
  }
  for (const name of toRemove) {
    html.removeAttribute(name)
  }
}

export function clearAllAccessibilitySettings(): void {
  if (typeof document === "undefined") return
  clearA11yAttributes(document.documentElement)
}
