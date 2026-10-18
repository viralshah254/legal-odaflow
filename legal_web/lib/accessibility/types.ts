export type AccessibilityProfileId =
  | "motorImpaired"
  | "blind"
  | "colorBlind"
  | "dyslexia"
  | "lowVision"
  | "cognitive"
  | "seizure"
  | "adhd"

export type TextScale = 0 | 1 | 2 | 3
export type LineHeightLevel = 0 | 1 | 2 | 3
export type SaturationLevel = "normal" | "low" | "high"
export type TextAlignOption = "default" | "left" | "center" | "right"

export interface AccessibilitySettings {
  activeProfile: AccessibilityProfileId | null
  oversizedWidget: boolean
  smartContrast: boolean
  pauseAnimations: boolean
  screenReaderEnhancements: boolean
  highContrast: boolean
  highlightLinks: boolean
  textScale: TextScale
  textSpacing: boolean
  hideImages: boolean
  dyslexiaFont: boolean
  largeCursor: boolean
  tooltips: boolean
  pageStructure: boolean
  lineHeight: LineHeightLevel
  textAlign: TextAlignOption
  dictionary: boolean
  saturation: SaturationLevel
}

export interface WidgetPosition {
  x: number
  y: number
}

export interface AccessibilityUIState {
  panelOpen: boolean
  widgetHidden: boolean
  position: WidgetPosition
}

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  activeProfile: null,
  oversizedWidget: false,
  smartContrast: false,
  pauseAnimations: false,
  screenReaderEnhancements: false,
  highContrast: false,
  highlightLinks: false,
  textScale: 0,
  textSpacing: false,
  hideImages: false,
  dyslexiaFont: false,
  largeCursor: false,
  tooltips: false,
  pageStructure: false,
  lineHeight: 0,
  textAlign: "default",
  dictionary: false,
  saturation: "normal",
}

export const DEFAULT_WIDGET_POSITION: WidgetPosition = {
  x: 24,
  y: 24,
}
