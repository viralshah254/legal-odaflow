import { setRequestLocale } from "next-intl/server"

/** SEO guides pre-render at build time with default English messages. */
export default function LegalGuidesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  setRequestLocale("en")
  return children
}
