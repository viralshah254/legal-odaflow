import type { Config } from "tailwindcss"
import sharedTokens from "./lib/theme/tokens.json"
import { motionTokens, shadowTokens, spacingTokens } from "./lib/theme/shared-tokens"

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./content/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: [sharedTokens.typography.fontFamily],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      spacing: {
        header: spacingTokens.header,
        "header-sm": spacingTokens.headerSm,
        container: spacingTokens.container,
        section: spacingTokens.section,
        card: spacingTokens.card,
        stack: spacingTokens.stack,
        inline: spacingTokens.inline,
      },
      padding: {
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-top": "env(safe-area-inset-top)",
      },
      boxShadow: {
        "token-sm": shadowTokens.sm,
        "token-md": shadowTokens.md,
        "token-lg": shadowTokens.lg,
        "token-xl": shadowTokens.xl,
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        token: sharedTokens.radius.default,
      },
      transitionDuration: {
        fast: motionTokens.durationFast,
        normal: motionTokens.durationNormal,
        slow: motionTokens.durationSlow,
      },
      transitionTimingFunction: {
        "ease-out-expo": motionTokens.easeOut,
        "ease-in-out-smooth": motionTokens.easeInOut,
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "page-enter": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "tab-enter": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "stagger-item": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "btn-shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(200%)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-down": {
          from: { opacity: "1", transform: "translateY(0)" },
          to: { opacity: "0", transform: "translateY(-6px)" },
        },
        "loading-bar": {
          "0%": { width: "0%", opacity: "1" },
          "85%": { width: "90%", opacity: "1" },
          "100%": { width: "90%", opacity: "0.7" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "page-enter": `page-enter ${motionTokens.durationSlow} ${motionTokens.easeOut} both`,
        "tab-enter": `tab-enter ${motionTokens.durationNormal} ${motionTokens.easeOut} both`,
        "stagger-item": `stagger-item ${motionTokens.durationNormal} ${motionTokens.easeOut} both`,
        "btn-shimmer": "btn-shimmer 1.6s ease-in-out infinite",
        "fade-up": "fade-up 0.25s ease-out both",
        "loading-bar": "loading-bar 4s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config

export default config
