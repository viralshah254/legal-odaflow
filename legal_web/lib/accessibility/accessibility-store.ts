import { create } from "zustand"
import { persist } from "zustand/middleware"
import { applyProfilePreset } from "./profiles"
import {
  DEFAULT_ACCESSIBILITY_SETTINGS,
  DEFAULT_WIDGET_POSITION,
  type AccessibilityProfileId,
  type AccessibilitySettings,
  type LineHeightLevel,
  type SaturationLevel,
  type TextAlignOption,
  type TextScale,
  type WidgetPosition,
} from "./types"

interface AccessibilityStore {
  settings: AccessibilitySettings
  panelOpen: boolean
  widgetHidden: boolean
  position: WidgetPosition

  setPanelOpen: (open: boolean) => void
  togglePanel: () => void
  setWidgetHidden: (hidden: boolean) => void
  setPosition: (position: WidgetPosition) => void

  toggleProfile: (profileId: AccessibilityProfileId) => void
  updateSetting: <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K],
  ) => void
  cycleTextScale: () => void
  cycleLineHeight: () => void
  cycleSaturation: () => void
  cycleTextAlign: () => void
  resetAll: () => void
}

export const useAccessibilityStore = create<AccessibilityStore>()(
  persist(
    (set, get) => ({
      settings: { ...DEFAULT_ACCESSIBILITY_SETTINGS },
      panelOpen: false,
      widgetHidden: false,
      position: { ...DEFAULT_WIDGET_POSITION },

      setPanelOpen: (open) => set({ panelOpen: open }),
      togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
      setWidgetHidden: (hidden) =>
        set({ widgetHidden: hidden, panelOpen: hidden ? false : get().panelOpen }),
      setPosition: (position) => set({ position }),

      toggleProfile: (profileId) => {
        const current = get().settings
        if (current.activeProfile === profileId) {
          set({ settings: { ...DEFAULT_ACCESSIBILITY_SETTINGS } })
          return
        }
        set({ settings: applyProfilePreset(profileId) })
      },

      updateSetting: (key, value) =>
        set((s) => ({
          settings: {
            ...s.settings,
            [key]: value,
            ...(key !== "activeProfile" && s.settings.activeProfile
              ? { activeProfile: null }
              : {}),
          },
        })),

      cycleTextScale: () => {
        const next = ((get().settings.textScale + 1) % 4) as TextScale
        get().updateSetting("textScale", next)
      },

      cycleLineHeight: () => {
        const next = ((get().settings.lineHeight + 1) % 4) as LineHeightLevel
        get().updateSetting("lineHeight", next)
      },

      cycleSaturation: () => {
        const order: SaturationLevel[] = ["normal", "low", "high"]
        const idx = order.indexOf(get().settings.saturation)
        const next = order[(idx + 1) % order.length]
        get().updateSetting("saturation", next)
      },

      cycleTextAlign: () => {
        const order: TextAlignOption[] = ["default", "left", "center", "right"]
        const idx = order.indexOf(get().settings.textAlign)
        const next = order[(idx + 1) % order.length]
        get().updateSetting("textAlign", next)
      },

      resetAll: () =>
        set({
          settings: { ...DEFAULT_ACCESSIBILITY_SETTINGS },
          panelOpen: false,
        }),
    }),
    {
      name: "umbrella-a11y",
      partialize: (state) => ({
        settings: state.settings,
        widgetHidden: state.widgetHidden,
        position: state.position,
      }),
    },
  ),
)
