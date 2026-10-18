import { ImageResponse } from "next/og"
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo/site-metadata"

export const runtime = "edge" as const
export const alt = `${SITE_NAME} — Legal AI for India, UK, US & Kenya`
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
          padding: "64px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "12px",
              background: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
            }}
          >
            ☂️
          </div>
          <span style={{ fontSize: "36px", fontWeight: 700, color: "#f8fafc" }}>
            {SITE_NAME}
          </span>
        </div>
        <p
          style={{
            fontSize: "42px",
            fontWeight: 700,
            color: "#f8fafc",
            lineHeight: 1.2,
            maxWidth: "900px",
            margin: "0 0 24px 0",
          }}
        >
          {SITE_TAGLINE}
        </p>
        <p style={{ fontSize: "22px", color: "#94a3b8", margin: 0 }}>
          Global legal AI · deep IN/US/KE/UK · drafting · contract review · law firm OS
        </p>
      </div>
    ),
    { ...size },
  )
}
