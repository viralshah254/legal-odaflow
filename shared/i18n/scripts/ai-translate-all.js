#!/usr/bin/env node
/**
 * AI-assisted translation: reads en/*.json, applies locale-overrides,
 * then applies phrase-level translations for remaining English text.
 * Writes complete shared/i18n/{locale}/*.json files.
 */
const fs = require('fs')
const path = require('path')
const { NAMESPACES, TARGET_LOCALES } = require('./namespaces')

const SHARED_I18N = path.join(__dirname, '..')
const OVERRIDES_DIR = path.join(__dirname, 'locale-overrides')
const PHRASES_PATH = path.join(__dirname, 'translation-phrases.json')

function loadJson(p) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {}
}

function deepMerge(base, override) {
  if (!override) return structuredClone(base)
  const out = structuredClone(base)
  for (const [key, value] of Object.entries(override)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && typeof out[key] === 'object' && out[key] !== null) {
      out[key] = deepMerge(out[key], value)
    } else {
      out[key] = value
    }
  }
  return out
}

function translateLeaf(text, locale, phraseMap) {
  if (!text || locale === 'en') return text
  const localeMap = phraseMap[locale]
  if (!localeMap) return text
  if (localeMap[text]) return localeMap[text]
  // Interpolate {name} placeholders preserved
  let out = text
  for (const [en, translated] of Object.entries(localeMap)) {
    if (en.length > 3 && out.includes(en)) {
      out = out.split(en).join(translated)
    }
  }
  return out
}

function translateTree(obj, locale, phraseMap) {
  if (typeof obj === 'string') return translateLeaf(obj, locale, phraseMap)
  if (Array.isArray(obj)) return obj.map((v) => translateTree(v, locale, phraseMap))
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = translateTree(v, locale, phraseMap)
  }
  return out
}

const phraseMap = loadJson(PHRASES_PATH)

for (const locale of TARGET_LOCALES) {
  const localeDir = path.join(SHARED_I18N, locale)
  fs.mkdirSync(localeDir, { recursive: true })

  for (const ns of NAMESPACES) {
    const enPath = path.join(SHARED_I18N, 'en', `${ns}.json`)
    if (!fs.existsSync(enPath)) continue
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))
    const override = loadJson(path.join(OVERRIDES_DIR, locale, `${ns}.json`))
    let merged = deepMerge(en, override)
    merged = translateTree(merged, locale, phraseMap)
    fs.writeFileSync(path.join(localeDir, `${ns}.json`), JSON.stringify(merged, null, 2) + '\n')
  }
  console.log(`[i18n:ai-translate] ${locale}`)
}
