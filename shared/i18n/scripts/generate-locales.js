#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { NAMESPACES, TARGET_LOCALES } = require('./namespaces')

const SHARED_I18N = path.join(__dirname, '..')
const OVERRIDES_DIR = path.join(__dirname, 'locale-overrides')

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

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

for (const locale of TARGET_LOCALES) {
  const localeDir = path.join(SHARED_I18N, locale)
  fs.mkdirSync(localeDir, { recursive: true })
  for (const ns of NAMESPACES) {
    const en = loadJson(path.join(SHARED_I18N, 'en', `${ns}.json`))
    if (!en) continue
    const override = loadJson(path.join(OVERRIDES_DIR, locale, `${ns}.json`))
    fs.writeFileSync(
      path.join(localeDir, `${ns}.json`),
      JSON.stringify(deepMerge(en, override), null, 2) + '\n',
    )
  }
  console.log(`[i18n:generate] ${locale}`)
}
