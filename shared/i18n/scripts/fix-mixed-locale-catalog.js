#!/usr/bin/env node
/**
 * Re-translate mixed-locale strings via Google Translate and update catalog + overrides.
 */
const fs = require('fs')
const path = require('path')
const { NAMESPACES, TARGET_LOCALES } = require('./namespaces')
const { translateTextAsync } = require('./translation-engine')

const SHARED_I18N = path.join(__dirname, '..')
const CATALOG_DIR = path.join(SHARED_I18N, 'translations/catalog')
const OVERRIDES_DIR = path.join(__dirname, 'locale-overrides')
const VIOLATIONS = path.join(SHARED_I18N, 'extraction/mixed-locale-violations.json')

function getByPath(obj, keyPath) {
  return keyPath.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)
}

function setByPath(obj, keyPath, value) {
  const parts = keyPath.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}
    cur = cur[parts[i]]
  }
  cur[parts[parts.length - 1]] = value
}

function loadEnMaps() {
  const maps = {}
  for (const ns of NAMESPACES) {
    const p = path.join(SHARED_I18N, 'en', `${ns}.json`)
    if (fs.existsSync(p)) maps[ns] = JSON.parse(fs.readFileSync(p, 'utf8'))
  }
  return maps
}

async function main() {
  if (!fs.existsSync(VIOLATIONS)) {
    console.error('[fix-mixed] No violations file — run check-mixed-locale.js first')
    process.exit(1)
  }
  const { violations } = JSON.parse(fs.readFileSync(VIOLATIONS, 'utf8'))
  const enMaps = loadEnMaps()
  const toFix = new Map()

  for (const v of violations) {
    const enVal = getByPath(enMaps[v.namespace], v.key)
    if (typeof enVal !== 'string') continue
    const k = `${v.locale}\0${enVal}`
    if (!toFix.has(k)) toFix.set(k, { locale: v.locale, en: enVal, keys: [] })
    toFix.get(k).keys.push(`${v.namespace}.${v.key}`)
  }

  // Manual coverage fixes
  toFix.set('de\0Demo', { locale: 'de', en: 'Demo', keys: ['marketing.header.demo'] })
  toFix.set('as\0Sending...', { locale: 'as', en: 'Sending...', keys: ['auth.sending'] })
  toFix.set('hi\0Country & jurisdiction', { locale: 'hi', en: 'Country & jurisdiction', keys: ['auth.country_jurisdiction', 'auth.countryJurisdiction'] })

  console.log(`[fix-mixed] Re-translating ${toFix.size} unique string(s)...`)
  let updated = 0

  for (const { locale, en, keys } of toFix.values()) {
    const catalogPath = path.join(CATALOG_DIR, `${locale}.json`)
    const catalog = fs.existsSync(catalogPath) ? JSON.parse(fs.readFileSync(catalogPath, 'utf8')) : {}
    const tr = await translateTextAsync(en, locale, { delay: 80 })
    if (!tr || tr === en) {
      console.warn(`[fix-mixed] skip (unchanged): ${locale} "${en.slice(0, 50)}"`)
      continue
    }
    catalog[en] = tr
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n')
    updated++

    for (const fullKey of keys) {
      const [ns, ...rest] = fullKey.split('.')
      const keyPath = rest.join('.')
      const overridePath = path.join(OVERRIDES_DIR, locale, `${ns}.json`)
      if (!fs.existsSync(overridePath)) continue
      const override = JSON.parse(fs.readFileSync(overridePath, 'utf8'))
      setByPath(override, keyPath, tr)
      fs.writeFileSync(overridePath, JSON.stringify(override, null, 2) + '\n')
    }
    if (updated % 20 === 0) console.log(`[fix-mixed] ${updated} catalog entries updated...`)
  }

  console.log(`[fix-mixed] Done — ${updated} catalog entries updated`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
