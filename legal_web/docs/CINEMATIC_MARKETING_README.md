# Cinematic marketing page

The root marketing page is assembled by `components/marketing/cinematic-home-page.tsx`.

## Editing content
- Update copy, navigation, feature information, CTAs, outcomes, footer links, and verification flags in `content/marketing.ts`.
- Replace the video assets described in `UMBRELLA_MARKETING_ASSETS.md`. Missing media is intentionally handled by the poster/visual fallback.
- The live hero canopy is isolated under `components/marketing/hero/`. It dynamically loads only on capable desktop devices; mobile, reduced-motion, and unavailable-WebGL environments receive `hero-fallback.tsx`.

## Motion
- Framer Motion provides section reveals and UI transitions.
- GSAP ScrollTrigger enhances the desktop operating-system sequence only.
- Lenis enhances scrolling only when reduced motion is not requested.
- All meaningful information remains available without animation.

## Before launch
1. Replace placeholder product film, poster, and captions.
2. Confirm every security claim in `content/marketing.ts`.
3. Add only approved customer proof and verified metrics.
4. Test keyboard navigation, reduced-motion rendering, missing video, and failed WebGL fallback.
