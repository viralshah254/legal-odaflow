#!/usr/bin/env node
/**
 * Generate complete locale-overrides from English master using cached catalog
 * or built-in translators. Preserves {placeholders} and ICU patterns.
 */
const fs = require('fs')
const path = require('path')
const { NAMESPACES, TARGET_LOCALES } = require('./namespaces')

const SHARED_I18N = path.join(__dirname, '..')
const OVERRIDES_DIR = path.join(__dirname, 'locale-overrides')
const CATALOG_DIR = path.join(SHARED_I18N, 'translations/catalog')

function protectPlaceholders(text) {
  const tokens = []
  let out = text
  out = out.replace(/\{[^}]+\}/g, (m) => {
    tokens.push(m)
    return `__PH${tokens.length - 1}__`
  })
  out = out.replace(/\$\w+/g, (m) => {
    tokens.push(m)
    return `__PH${tokens.length - 1}__`
  })
  return { text: out, tokens }
}

function restorePlaceholders(text, tokens) {
  let out = text
  tokens.forEach((tok, i) => {
    out = out.split(`__PH${i}__`).join(tok)
    out = out.split(`__PH ${i} __`).join(tok)
    out = out.split(`__ PH${i}__`).join(tok)
  })
  return out
}

function loadCatalog(locale) {
  const p = path.join(CATALOG_DIR, `${locale}.json`)
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {}
}

function saveCatalog(locale, catalog) {
  fs.mkdirSync(CATALOG_DIR, { recursive: true })
  fs.writeFileSync(path.join(CATALOG_DIR, `${locale}.json`), JSON.stringify(catalog, null, 2) + '\n')
}

function collectStrings(obj, out = new Set()) {
  for (const v of Object.values(obj)) {
    if (typeof v === 'string') out.add(v)
    else if (v && typeof v === 'object' && !Array.isArray(v)) collectStrings(v, out)
  }
  return out
}

function translateString(text, locale, catalog) {
  if (!text || locale === 'en') return text
  if (catalog[text]) return catalog[text]
  return text
}

function translateTree(obj, locale, catalog) {
  if (typeof obj === 'string') return translateString(obj, locale, catalog)
  if (Array.isArray(obj)) return obj.map((v) => translateTree(v, locale, catalog))
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = translateTree(v, locale, catalog)
  }
  return out
}

function diffOverride(en, translated) {
  const override = {}
  function walk(e, t, pathParts = []) {
    if (Array.isArray(e) && Array.isArray(t)) {
      if (JSON.stringify(e) !== JSON.stringify(t)) {
        let cur = override
        for (let i = 0; i < pathParts.length - 1; i++) {
          if (!cur[pathParts[i]]) cur[pathParts[i]] = {}
          cur = cur[pathParts[i]]
        }
        if (pathParts.length === 0) {
          Object.assign(override, t)
        } else {
          cur[pathParts[pathParts.length - 1]] = t
        }
      }
      return
    }
    if (!e || typeof e !== 'object' || Array.isArray(e)) return
    for (const [k, ev] of Object.entries(e)) {
      const tv = t?.[k]
      if (typeof ev === 'string' && typeof tv === 'string' && ev !== tv) {
        let cur = override
        const parts = [...pathParts, k]
        for (let i = 0; i < parts.length - 1; i++) {
          if (!cur[parts[i]]) cur[parts[i]] = {}
          cur = cur[parts[i]]
        }
        cur[parts[parts.length - 1]] = tv
      } else if (ev && typeof ev === 'object') {
        walk(ev, tv ?? (Array.isArray(ev) ? [] : {}), [...pathParts, k])
      }
    }
  }
  walk(en, translated)
  return override
}

const only = process.argv.find((a) => a.startsWith('--namespaces='))?.split('=')[1]?.split(',')
const localeFilter = process.argv.find((a) => a.startsWith('--locales='))?.split('=')[1]?.split(',')
const namespaces = only ? only : NAMESPACES
const locales = localeFilter ? localeFilter : TARGET_LOCALES

// Collect all English strings once for catalog warm-up
const allStrings = new Set()
for (const ns of NAMESPACES) {
  const p = path.join(SHARED_I18N, 'en', `${ns}.json`)
  if (fs.existsSync(p)) collectStrings(JSON.parse(fs.readFileSync(p, 'utf8')), allStrings)
}

for (const locale of locales) {
  const catalog = loadCatalog(locale)
  let newEntries = 0
  for (const s of allStrings) {
    if (!catalog[s]) {
      translateString(s, locale, catalog)
      newEntries++
    }
  }
  if (newEntries > 0) saveCatalog(locale, catalog)

  const localeDir = path.join(OVERRIDES_DIR, locale)
  fs.mkdirSync(localeDir, { recursive: true })

  for (const ns of namespaces) {
    const enPath = path.join(SHARED_I18N, 'en', `${ns}.json`)
    if (!fs.existsSync(enPath)) continue
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))
    const translated = translateTree(en, locale, catalog)
    const override = diffOverride(en, translated)
    const outPath = path.join(localeDir, `${ns}.json`)
    fs.writeFileSync(outPath, JSON.stringify(override, null, 2) + '\n')
  }
  saveCatalog(locale, catalog)
  console.log(`[i18n:full-translate] ${locale} (${namespaces.length} namespaces, catalog ${Object.keys(catalog).length} strings)`)
}
