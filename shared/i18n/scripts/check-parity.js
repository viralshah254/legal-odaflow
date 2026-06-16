#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { NAMESPACES } = require('./namespaces')

const SHARED_I18N = path.join(__dirname, '..')

function flattenKeys(obj, prefix, out) {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flattenKeys(value, fullKey, out)
    } else {
      out.add(fullKey)
    }
  }
}

function loadKeys(locale) {
  const keys = new Set()
  for (const ns of NAMESPACES) {
    const filePath = path.join(SHARED_I18N, locale, `${ns}.json`)
    if (!fs.existsSync(filePath)) continue
    flattenKeys(JSON.parse(fs.readFileSync(filePath, 'utf8')), ns, keys)
  }
  return keys
}

const enKeys = loadKeys('en')
console.log(`[i18n:check] en reference: ${enKeys.size} keys`)

let failed = false
for (const locale of fs.readdirSync(SHARED_I18N, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !['scripts', 'extraction', 'en', 'translations'].includes(d.name))
  .map((d) => d.name)) {
  const localeKeys = loadKeys(locale)
  const missing = [...enKeys].filter((k) => !localeKeys.has(k))
  const extra = [...localeKeys].filter((k) => !enKeys.has(k))
  if (missing.length || extra.length) {
    failed = true
    console.error(`[i18n:check] ${locale}: missing=${missing.length}, extra=${extra.length}`)
    if (missing.length) console.error(`  sample missing: ${missing.slice(0, 3).join(', ')}`)
  } else {
    console.log(`[i18n:check] ${locale}: OK (${localeKeys.size} keys)`)
  }
}

if (failed) process.exit(1)
