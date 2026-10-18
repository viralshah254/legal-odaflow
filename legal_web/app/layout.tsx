import type { Metadata, Viewport } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Providers } from "./providers"
import {
  getSiteUrl,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TITLE,
} from "@/lib/seo/site-metadata"
import { isRtlLocale } from "@/lib/i18n/locales"
import { getBodyFontClassName } from "@/lib/fonts/root-fonts"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
}

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: getSiteUrl(),
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: getSiteUrl(),
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()
  const dir = isRtlLocale(locale) ? "rtl" : "ltr"
  const bodyFontClassName = await getBodyFontClassName()

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={bodyFontClassName}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers initialLocale={locale}>{children}</Providers>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  )
}
