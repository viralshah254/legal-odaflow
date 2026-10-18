import sharedTokens from "./tokens.json"

export { sharedTokens }

export const motionTokens = {
  durationFast: "150ms",
  durationNormal: "250ms",
  durationSlow: "400ms",
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const

export const spacingTokens = {
  header: "4rem",
  headerSm: "5rem",
  container: "80rem",
  section: "6rem",
  card: "1.5rem",
  stack: "1rem",
  inline: "0.5rem",
} as const

export const shadowTokens = {
  sm: "0 1px 2px 0 rgb(15 23 42 / 0.05)",
  md: "0 4px 6px -1px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.06)",
  lg: "0 10px 15px -3px rgb(15 23 42 / 0.08), 0 4px 6px -4px rgb(15 23 42 / 0.06)",
  xl: "0 20px 25px -5px rgb(15 23 42 / 0.08), 0 8px 10px -6px rgb(15 23 42 / 0.06)",
} as const
