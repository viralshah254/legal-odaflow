# Umbrella marketing asset requirements

## Replaceable assets

| Asset | Destination | Format | Notes |
| --- | --- | --- | --- |
| Hero loop | `public/video/umbrella-hero-loop.webm` and `.mp4` | WebM + MP4 | 8–12 seconds, muted, seamless, 16:9 |
| Full product film | `public/video/umbrella-product-film.webm` and `.mp4` | WebM + MP4 | 45–60 seconds, captions required |
| Film poster | `public/video/umbrella-film-poster.webp` | WebP | 16:9, include enough contrast for controls |
| Captions | `public/video/umbrella-product-film.vtt` | WebVTT | Accurate captions, reviewed before launch |
| Product UI frames | `public/marketing/` | AVIF/WebP | Use explicit dimensions and descriptive names |
| Customer proof | `public/marketing/customers/` | SVG preferred | Only approved customer logos and quotations |

## Content rules
- Do not publish numerical outcomes, customer marks, awards, or certifications without approval.
- Security content in `content/marketing.ts` marks claims as verified or pending; only verified copy should ship as a capability claim.
- All fictional product examples must retain fictional names and matters.

## Performance budget
- Hero loop: target under 1.5 MB WebM and 2.5 MB MP4.
- Poster: target under 180 KB at display size.
- Lazy-load the full film and all below-fold imagery.
- Prefer AVIF/WebP for images, include dimensions, and preload only the logo/font/hero poster when needed.
