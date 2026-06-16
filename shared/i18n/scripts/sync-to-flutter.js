#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { NAMESPACES, FILE_TO_NS } = require('./namespaces')

const ROOT = path.join(__dirname, '../../..')
const SHARED_I18N = path.join(__dirname, '..')
const FLUTTER_L10N = path.join(ROOT, 'legal_app/lib/l10n')

const { toDartKey } = require('./arb-keys')

function flatten(obj, prefix, out, keyMap, rawValues) {
  for (const [key, value] of Object.entries(obj)) {
    const rawKey = prefix ? `${prefix}_${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, rawKey, out, keyMap, rawValues)
    } else {
      const dartKey = toDartKey(rawKey)
      let finalKey = dartKey
      let n = 2
      while (out[finalKey] && out[finalKey] !== String(value)) {
        finalKey = `${dartKey}${n++}`
      }
      out[finalKey] = String(value)
      keyMap[finalKey] = rawKey
      if (rawValues) rawValues[rawKey] = String(value)
    }
  }
}

function loadLocaleFlat(locale) {
  const flat = {}
  const keyMap = {}
  const rawValues = {}
  for (const ns of NAMESPACES) {
    const filePath = path.join(SHARED_I18N, locale, `${ns}.json`)
    if (!fs.existsSync(filePath)) continue
    flatten(JSON.parse(fs.readFileSync(filePath, 'utf8')), FILE_TO_NS[ns] || ns, flat, keyMap, rawValues)
  }
  return { flat, keyMap, rawValues }
}

function backfillFromEnglish(enFlat, enKeyMap, localeFlat, localeRawValues) {
  for (const dartKey of Object.keys(enFlat)) {
    if (dartKey in localeFlat) continue
    const rawKey = enKeyMap[dartKey]
    if (rawKey && rawKey in localeRawValues) {
      localeFlat[dartKey] = localeRawValues[rawKey]
    } else {
      // Fall back to English until locale translation exists.
      localeFlat[dartKey] = enFlat[dartKey]
    }
  }
}

function escapeArb(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

function extractPlaceholders(value) {
  const seen = new Set()
  const names = []
  for (const match of value.matchAll(/\{(\w+)\}/g)) {
    const name = match[1]
    if (!seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  }
  return names
}

function toArb(locale, flat) {
  const entries = [`  "@@locale": "${locale}"`]
  for (const key of Object.keys(flat).sort()) {
    entries.push(`  "${key}": "${escapeArb(flat[key])}"`)
    const placeholders = extractPlaceholders(flat[key])
    if (placeholders.length > 0) {
      const phEntries = placeholders
        .map((p) => `    "${p}": {\n      "type": "String"\n    }`)
        .join(',\n')
      entries.push(`  "@${key}": {\n    "placeholders": {\n${phEntries}\n    }\n  }`)
    }
  }
  return '{\n' + entries.join(',\n') + '\n}\n'
}

function getLocaleDirs() {
  return fs
    .readdirSync(SHARED_I18N, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !['scripts', 'extraction', 'translations'].includes(d.name))
    .map((d) => d.name)
}

const { flat: enFlat, keyMap: enKeyMap } = loadLocaleFlat('en')

for (const locale of getLocaleDirs()) {
  const { flat, rawValues } = loadLocaleFlat(locale)
  if (locale !== 'en') {
    backfillFromEnglish(enFlat, enKeyMap, flat, rawValues)
  }
  fs.mkdirSync(FLUTTER_L10N, { recursive: true })
  fs.writeFileSync(path.join(FLUTTER_L10N, `app_${locale}.arb`), toArb(locale, flat))
  console.log(`[i18n:sync-flutter] ${locale} (${Object.keys(flat).length} keys)`)
}
