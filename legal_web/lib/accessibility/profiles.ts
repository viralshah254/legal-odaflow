import type { AccessibilityProfileId, AccessibilitySettings } from "./types"
import { DEFAULT_ACCESSIBILITY_SETTINGS } from "./types"

type ProfilePreset = Partial<Omit<AccessibilitySettings, "activeProfile">>

export const ACCESSIBILITY_PROFILES: Record<
  AccessibilityProfileId,
  { preset: ProfilePreset }
> = {
  motorImpaired: {
    preset: {
      pauseAnimations: true,
      highlightLinks: true,
      largeCursor: true,
    },
  },
  blind: {
    preset: {
      smartContrast: true,
      highContrast: true,
      screenReaderEnhancements: true,
    },
  },
  colorBlind: {
    preset: {
      saturation: "low",
    },
  },
  dyslexia: {
    preset: {
      dyslexiaFont: true,
      textSpacing: true,
      lineHeight: 2,
      textScale: 1,
    },
  },
  lowVision: {
    preset: {
      textScale: 2,
      highContrast: true,
      highlightLinks: true,
    },
  },
  cognitive: {
    preset: {
      pauseAnimations: true,
      hideImages: true,
      tooltips: true,
    },
  },
  seizure: {
    preset: {
      pauseAnimations: true,
      saturation: "low",
    },
  },
  adhd: {
    preset: {
      pauseAnimations: true,
      highlightLinks: true,
      hideImages: true,
    },
  },
}

export function applyProfilePreset(
  profileId: AccessibilityProfileId,
): AccessibilitySettings {
  const preset = ACCESSIBILITY_PROFILES[profileId]?.preset ?? {}
  return {
    ...DEFAULT_ACCESSIBILITY_SETTINGS,
    ...preset,
    activeProfile: profileId,
  }
}
