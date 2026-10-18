import fs from "fs"
import path from "path"
import { ImageResponse } from "next/og"
import { SITE_DESCRIPTION } from "./site-metadata"

export const OG_IMAGE_SIZE = {
  width: 1200,
  height: 630,
} as const

export const OG_IMAGE_CONTENT_TYPE = "image/png"

interface OgImageOptions {
  subtitle?: string
}

export function createOgImageResponse(options: OgImageOptions = {}) {
  const subtitle = options.subtitle ?? SITE_DESCRIPTION

  // Load the light logo (white wordmark) for use on the dark gradient background.
  // readFileSync works in both the Next.js edge runtime (via Node.js compat) and
  // at build time. The path resolves relative to the project root at runtime.
  let logoDataUrl: string | null = null
  try {
    const logoPath = path.join(process.cwd(), "public/brand/umbrella-logo-light.png")
    const logoBuffer = fs.readFileSync(logoPath)
    logoDataUrl = `data:image/png;base64,${logoBuffer.toString("base64")}`
  } catch {
    // If the file can't be read (e.g. during static analysis), fall back to text.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #0F172A 0%, #1E3A8A 52%, #2563EB 100%)",
          color: "#F8FAFC",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoDataUrl}
              alt="Umbrella"
              style={{ height: "64px", width: "auto", objectFit: "contain" }}
            />
          ) : (
            <div style={{ fontSize: "52px", fontWeight: 800 }}>Umbrella</div>
          )}
        </div>

        {/* Tagline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "960px" }}>
          <div
            style={{
              fontSize: "52px",
              fontWeight: 700,
              lineHeight: 1.2,
              color: "#F8FAFC",
            }}
          >
            {subtitle}
          </div>
          <div
            style={{
              fontSize: "26px",
              color: "#93C5FD",
              letterSpacing: "0.04em",
            }}
          >
            umbrella.okaylegal.ai
          </div>
        </div>
      </div>
    ),
    {
      ...OG_IMAGE_SIZE,
    },
  )
}
