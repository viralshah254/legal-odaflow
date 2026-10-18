#!/usr/bin/env node
/**
 * Translate signup UX keys added in en.json to all locales.
 */
const fs = require('fs')
const path = require('path')
const { translateTextAsync } = require('../../shared/i18n/scripts/translation-engine')

const MESSAGES_DIR = path.join(__dirname, '../messages')
const en = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, 'en.json'), 'utf8'))

const TARGET_PATHS = [
  ['auth', 'accountIndividualBody'],
  ['auth', 'accountLawFirmBody'],
  ['auth', 'needLegalHelpBody'],
  ['auth', 'iAmLawyerBody'],
  ['auth', 'lawyerPerk1'],
  ['auth', 'lawyerPerk2'],
  ['auth', 'clientPerk1'],
  ['auth', 'clientPerk2'],
  ['auth', 'signUpStepWorkspace'],
  ['auth', 'signUpStepAccount'],
  ['auth', 'signUpAccountTitle'],
  ['auth', 'signUpAccountDescription'],
  ['auth', 'pathSummarySoloLawyer'],
  ['auth', 'pathSummaryLegalHelp'],
  ['auth', 'pathSummaryLawFirm'],
  ['auth', 'whichProfileSubtitle'],
  ['auth', 'mostCommon'],
  ['auth', 'prospectPrefillHint'],
  ['issueChecker', 'detectedCountryRegionChange'],
]

function get(obj, parts) {
  return parts.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)
}

function set(obj, parts, value) {
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}
    cur = cur[parts[i]]
  }
  cur[parts[parts.length - 1]] = value
}

function maskPlaceholders(text) {
  const store = []
  let masked = text
  const push = (m) => {
    store.push(m)
    return `\uE000${store.length - 1}\uE001`
  }
  masked = masked.replace(/\{[^}]+\}/g, push)
  masked = masked.replace(/\$[a-zA-Z][a-zA-Z0-9_]*/g, push)
  masked = masked.replace(/<\/?[a-zA-Z]+>/g, push)
  return { masked, store }
}

function unmask(text, store) {
  return text.replace(/\uE000(\d+)\uE001/g, (_, i) => store[Number(i)] ?? '')
}

async function translate(enText, locale) {
  const { masked, store } = maskPlaceholders(enText)
  const out = unmask(await translateTextAsync(masked, locale, { delay: 20 }), store)
  return out.trim() || enText
}

async function main() {
  const locales = fs
    .readdirSync(MESSAGES_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'en.json')
    .map((f) => f.replace('.json', ''))

  for (const locale of locales) {
    const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
    const loc = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    let count = 0

    for (const parts of TARGET_PATHS) {
      const enVal = get(en, parts)
      if (typeof enVal !== 'string') continue
      const translated = await translate(enVal, locale)
      set(loc, parts, translated)
      count++
    }

    const trust1 = get(loc, ['marketing', 'home', 'hero', 'trust1'])
    const trust2 = get(loc, ['marketing', 'home', 'hero', 'trust2'])
    const trust3 = get(loc, ['marketing', 'home', 'hero', 'trust3'])
    if (trust1) set(loc, ['marketing', 'home', 'guestSignup', 'perkCredits'], trust1)
    if (trust2) set(loc, ['marketing', 'home', 'guestSignup', 'perkNoTraining'], trust2)
    if (trust3) set(loc, ['marketing', 'home', 'guestSignup', 'perkPrivate'], trust3)

    fs.writeFileSync(filePath, JSON.stringify(loc, null, 2) + '\n')
    console.log(`[translate-signup-keys] ${locale}: ${count} auth keys + guest perks`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
