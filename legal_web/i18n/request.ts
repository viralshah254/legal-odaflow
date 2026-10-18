import { getRequestConfig } from 'next-intl/server'
import type { AbstractIntlMessages } from 'next-intl'
import { unstable_noStore as noStore } from 'next/cache'
import { cookies, headers } from 'next/headers'
import {
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  normalizeLocale,
  SUPPORTED_LOCALE_CODES,
} from '@/lib/i18n/locales'

type MessageModule = { default: unknown }


/** One dynamic chunk per locale — only the active locale is loaded per request. */
const MESSAGE_LOADERS: Record<string, () => Promise<MessageModule>> = {
  en: () => import('@/messages/en.json'),
  fr: () => import('@/messages/fr.json'),
  de: () => import('@/messages/de.json'),
  hi: () => import('@/messages/hi.json'),
  bn: () => import('@/messages/bn.json'),
  te: () => import('@/messages/te.json'),
  mr: () => import('@/messages/mr.json'),
  ta: () => import('@/messages/ta.json'),
  gu: () => import('@/messages/gu.json'),
  kn: () => import('@/messages/kn.json'),
  ml: () => import('@/messages/ml.json'),
  ur: () => import('@/messages/ur.json'),
  pa: () => import('@/messages/pa.json'),
  or: () => import('@/messages/or.json'),
  as: () => import('@/messages/as.json'),
}

async function loadMessages(locale: string): Promise<AbstractIntlMessages> {
  const loader = MESSAGE_LOADERS[locale] ?? MESSAGE_LOADERS.en
  const mod = await loader()
  return mod.default as AbstractIntlMessages
}

async function resolveLocale(): Promise<string> {
  noStore()
  const cookieStore = cookies()
  const fromCookie = normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value)
  if (fromCookie && SUPPORTED_LOCALE_CODES.includes(fromCookie)) {
    return fromCookie
  }

  const acceptLanguage = headers().get('accept-language')
  if (acceptLanguage) {
    const preferred = acceptLanguage
      .split(',')
      .map((part) => part.split(';')[0]?.trim())
      .filter(Boolean)
    for (const tag of preferred) {
      const base = normalizeLocale(tag)
      if (SUPPORTED_LOCALE_CODES.includes(base)) return base
    }
  }

  return 'en'
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale()
  const messages = await loadMessages(locale)

  return {
    locale,
    messages,
  }
})

export { LOCALE_COOKIE_NAME, LOCALE_STORAGE_KEY }
