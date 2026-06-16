#!/usr/bin/env node
/**
 * Rule-based + phrase-map translator for legal UI strings.
 * Used by generate-full-translations.js; catalog caches results.
 */
const fs = require('fs')
const path = require('path')

const PHRASES_PATH = path.join(__dirname, 'translation-phrases.json')

/** BCP-47 targets for Indian locales */
const LOCALE_TARGETS = {
  fr: 'fr',
  de: 'de',
  hi: 'hi',
  bn: 'bn',
  te: 'te',
  mr: 'mr',
  ta: 'ta',
  gu: 'gu',
  kn: 'kn',
  ml: 'ml',
  ur: 'ur',
  pa: 'pa',
  or: 'or',
  as: 'as',
}

/** Do not translate brand / codes */
const SKIP_EXACT = new Set([
  'Umbrella',
  'DVTech Ventures',
  'USD', 'GBP', 'EUR', 'KES', 'INR',
  'API', 'AI', 'KYC', 'OTP', 'PDF', 'URL', 'SMS', 'FCM',
])

let phraseMaps = {}
if (fs.existsSync(PHRASES_PATH)) {
  phraseMaps = JSON.parse(fs.readFileSync(PHRASES_PATH, 'utf8'))
}

/** Core UI vocabulary per locale (longest-first substitution) */
const CORE = {
  fr: {
    'Sign out': 'Se déconnecter', 'Sign in': 'Se connecter', 'Sign up': "S'inscrire",
    'Save': 'Enregistrer', 'Cancel': 'Annuler', 'Close': 'Fermer', 'Continue': 'Continuer',
    'Back': 'Retour', 'Next': 'Suivant', 'Submit': 'Soumettre', 'Delete': 'Supprimer',
    'Edit': 'Modifier', 'Create': 'Créer', 'Search': 'Rechercher', 'Loading…': 'Chargement…',
    'Settings': 'Paramètres', 'Profile': 'Profil', 'Dashboard': 'Tableau de bord',
    'Clients': 'Clients', 'Matters': 'Dossiers', 'Tasks': 'Tâches', 'Documents': 'Documents',
    'Invoices': 'Factures', 'Reports': 'Rapports', 'Required': 'Obligatoire', 'Optional': 'Facultatif',
    'Something went wrong': "Une erreur s'est produite", 'Retry': 'Réessayer',
    'No results found': 'Aucun résultat', 'Country': 'Pays', 'Language': 'Langue',
    'Privacy Policy': 'Politique de confidentialité', 'Terms of Service': "Conditions d'utilisation",
    'legal advice': 'conseil juridique', 'matter': 'dossier', 'matters': 'dossiers',
    'client': 'client', 'clients': 'clients', 'invoice': 'facture', 'trust': 'fiducie',
    'copilot': 'Copilot', 'error': 'erreur', 'success': 'succès', 'warning': 'avertissement',
  },
  de: {
    'Sign out': 'Abmelden', 'Sign in': 'Anmelden', 'Sign up': 'Registrieren',
    'Save': 'Speichern', 'Cancel': 'Abbrechen', 'Close': 'Schließen', 'Continue': 'Weiter',
    'Back': 'Zurück', 'Next': 'Weiter', 'Submit': 'Absenden', 'Delete': 'Löschen',
    'Edit': 'Bearbeiten', 'Create': 'Erstellen', 'Search': 'Suchen', 'Loading…': 'Wird geladen…',
    'Settings': 'Einstellungen', 'Profile': 'Profil', 'Dashboard': 'Dashboard',
    'Clients': 'Mandanten', 'Matters': 'Mandate', 'Tasks': 'Aufgaben', 'Documents': 'Dokumente',
    'Invoices': 'Rechnungen', 'Reports': 'Berichte', 'Required': 'Erforderlich', 'Optional': 'Optional',
    'Something went wrong': 'Etwas ist schiefgelaufen', 'Retry': 'Erneut versuchen',
    'No results found': 'Keine Ergebnisse', 'Country': 'Land', 'Language': 'Sprache',
    'Privacy Policy': 'Datenschutzerklärung', 'Terms of Service': 'Nutzungsbedingungen',
    'legal advice': 'Rechtsberatung', 'matter': 'Mandat', 'matters': 'Mandate',
    'client': 'Mandant', 'clients': 'Mandanten', 'invoice': 'Rechnung', 'trust': 'Treuhand',
    'error': 'Fehler', 'success': 'Erfolg', 'warning': 'Warnung',
  },
  hi: {
    'Sign out': 'साइन आउट', 'Sign in': 'साइन इन', 'Sign up': 'साइन अप',
    'Save': 'सहेजें', 'Cancel': 'रद्द करें', 'Close': 'बंद करें', 'Continue': 'जारी रखें',
    'Back': 'वापस', 'Next': 'अगला', 'Submit': 'जमा करें', 'Delete': 'हटाएं',
    'Edit': 'संपादित करें', 'Create': 'बनाएं', 'Search': 'खोजें', 'Loading…': 'लोड हो रहा है…',
    'Settings': 'सेटिंग्स', 'Profile': 'प्रोफ़ाइल', 'Dashboard': 'डैशबोर्ड',
    'Clients': 'ग्राहक', 'Matters': 'मामले', 'Tasks': 'कार्य', 'Documents': 'दस्तावेज़',
    'Invoices': 'चालान', 'Reports': 'रिपोर्ट', 'Required': 'आवश्यक', 'Optional': 'वैकल्पिक',
    'Something went wrong': 'कुछ गलत हो गया', 'Retry': 'पुनः प्रयास करें',
    'Country': 'देश', 'Language': 'भाषा',
    'Privacy Policy': 'गोपनीयता नीति', 'Terms of Service': 'सेवा की शर्तें',
    'legal advice': 'कानूनी सलाह', 'matter': 'मामला', 'client': 'ग्राहक',
  },
}

/** Indian locales share Hindi patterns until full native maps exist */
for (const loc of ['bn', 'te', 'mr', 'ta', 'gu', 'kn', 'ml', 'ur', 'pa', 'or', 'as']) {
  if (!CORE[loc]) CORE[loc] = { ...CORE.hi }
}

function applyPhraseMap(text, locale) {
  const custom = phraseMaps[locale]
  if (custom && custom[text]) return custom[text]
  const map = CORE[locale]
  if (!map) return text
  if (map[text]) return map[text]
  let out = text
  const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length)
  for (const [en, tr] of entries) {
    if (en.length > 2 && out.includes(en)) {
      out = out.split(en).join(tr)
    }
  }
  return out
}

async function translateViaGoogle(text, locale) {
  const target = LOCALE_TARGETS[locale] || locale
  const url = new URL('https://translate.googleapis.com/translate_a/single')
  url.searchParams.set('client', 'gtx')
  url.searchParams.set('sl', 'en')
  url.searchParams.set('tl', target)
  url.searchParams.set('dt', 't')
  url.searchParams.set('q', text)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`translate HTTP ${res.status}`)
  const data = await res.json()
  return data[0]?.map((x) => x[0]).join('') || text
}

const INDIC = /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/
const LATIN_WORD = /\b[A-Za-z]{3,}\b/

const ORIYA = /[\u0B00-\u0B7F]/

function hasMixedIndicLatin(text) {
  if (!INDIC.test(text)) return false
  const stripped = text.replace(/\{[^}]+\}/g, ' ').replace(/\$[a-zA-Z][a-zA-Z0-9_]*/g, ' ')
  const words = stripped.match(LATIN_WORD)
  return Boolean(words && words.some((w) => w.length > 2))
}

function orTranslateWorkarounds(text) {
  const out = [text]
  if (/^No /i.test(text)) {
    out.push(text.replace(/^No /i, 'Nothing '))
    out.push(text.replace(/^No /i, 'There are no '))
  }
  if (/^Optional$/i.test(text)) out.push('Not required')
  if (/^Mark all read$/i.test(text)) out.push('Mark everything as read')
  if (/^Intellectual property$/i.test(text)) out.push('IP rights')
  if (/^Mark all read$/i.test(text)) out.push('Mark all as viewed')
  return [...new Set(out)]
}

async function translateViaGoogleBest(text, locale, opts = {}) {
  const delay = opts.delay ?? 50
  const candidates = locale === 'or' ? orTranslateWorkarounds(text) : [text]
  let fallback = text
  for (const q of candidates) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay))
    try {
      const tr = await translateViaGoogle(q, locale)
      if (!tr?.trim()) continue
      if (locale === 'or' && hasMixedIndicLatin(tr)) {
        fallback = tr
        continue
      }
      return tr
    } catch {
      /* try next */
    }
  }
  if (locale === 'or') {
    try {
      const hi = await translateViaGoogle(text, 'hi')
      if (hi && !hasMixedIndicLatin(hi)) {
        await new Promise((r) => setTimeout(r, delay))
        const tr = await translateViaGoogle(hi, locale)
        if (tr && ORIYA.test(tr)) return tr
      }
    } catch {
      /* fall through */
    }
  }
  return fallback !== text ? fallback : text
}

let useGoogle = process.env.I18N_USE_GOOGLE !== '0'

function translateText(text, locale) {
  if (!text || locale === 'en') return text
  if (SKIP_EXACT.has(text)) return text
  const phrase = applyPhraseMap(text, locale)
  if (phrase !== text) return phrase
  return text // sync fallback; async batch fills via catalog
}

async function translateTextAsync(text, locale, opts = {}) {
  if (!text || locale === 'en') return text
  if (SKIP_EXACT.has(text)) return text
  if (useGoogle && opts.preferGoogle !== false) {
    try {
      const tr = await translateViaGoogleBest(text, locale, { delay: opts.delay ?? 50 })
      if (tr && tr.trim() && tr !== text) return tr
      if (tr && tr.trim() && !hasMixedIndicLatin(tr)) return tr
    } catch {
      /* fall through */
    }
  }
  const phrase = applyPhraseMap(text, locale)
  if (locale === 'or' || locale === 'as') return phrase !== text && !hasMixedIndicLatin(phrase) ? phrase : text
  return phrase !== text ? phrase : text
}

module.exports = { translateText, translateTextAsync, applyPhraseMap, LOCALE_TARGETS, hasMixedIndicLatin, translateViaGoogleBest }
