#!/usr/bin/env node
/**
 * Translate keys present in en but missing or still English in locale-overrides.
 * Uses Google Translate via translation-engine (set I18N_USE_GOOGLE=0 to skip).
 */
const fs = require('fs')
const path = require('path')
const { TARGET_LOCALES } = require('./namespaces')
const { translateTextAsync } = require('./translation-engine')

const SHARED = path.join(__dirname, '..')
const OVERRIDES = path.join(__dirname, 'locale-overrides')
const NAMESPACES = (process.argv.find((a) => a.startsWith('--namespaces='))?.split('=')[1] || 'marketing,legal').split(',')
const LOCALE_FILTER = process.argv.find((a) => a.startsWith('--locales='))?.split('=')[1]?.split(',')
const LOCALES = LOCALE_FILTER || TARGET_LOCALES
const DELAY = parseInt(process.env.I18N_TRANSLATE_DELAY || '40', 10)

function deepMerge(base, override) {
  if (!override) return structuredClone(base)
  const out = structuredClone(base)
  for (const [key, value] of Object.entries(override)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof out[key] === 'object' &&
      out[key] !== null &&
      !Array.isArray(out[key])
    ) {
      out[key] = deepMerge(out[key], value)
    } else {
      out[key] = value
    }
  }
  return out
}

function flattenLeaves(obj, prefix = []) {
  const out = []
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...flattenLeaves(value, [...prefix, key]))
    } else if (typeof value === 'string') {
      out.push({ path: [...prefix, key], value })
    }
  }
  return out
}

function getAt(obj, pathParts) {
  let cur = obj
  for (const part of pathParts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[part]
  }
  return cur
}

function setAt(obj, pathParts, value) {
  let cur = obj
  for (let i = 0; i < pathParts.length - 1; i++) {
    if (!cur[pathParts[i]] || typeof cur[pathParts[i]] !== 'object') {
      cur[pathParts[i]] = {}
    }
    cur = cur[pathParts[i]]
  }
  cur[pathParts[pathParts.length - 1]] = value
}

function protectPlaceholders(text) {
  const tokens = []
  let out = text
  out = out.replace(/\{[^}]+\}/g, (m) => {
    tokens.push(m)
    return `__PH${tokens.length - 1}__`
  })
  return { text: out, tokens }
}

function restorePlaceholders(text, tokens) {
  let out = text
  tokens.forEach((tok, i) => {
    out = out.split(`__PH${i}__`).join(tok)
  })
  return out
}

async function translateValue(text, locale) {
  const { text: prot, tokens } = protectPlaceholders(text)
  const translated = await translateTextAsync(prot, locale, { delay: DELAY })
  return restorePlaceholders(translated, tokens)
}

async function processLocale(locale) {
  for (const ns of NAMESPACES) {
    const enPath = path.join(SHARED, 'en', `${ns}.json`)
    if (!fs.existsSync(enPath)) continue

    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))
    const overridePath = path.join(OVERRIDES, locale, `${ns}.json`)
    const existingOverride = fs.existsSync(overridePath)
      ? JSON.parse(fs.readFileSync(overridePath, 'utf8'))
      : {}
    const merged = deepMerge(en, existingOverride)

    const patch = {}
    const leaves = flattenLeaves(en)
    let translated = 0

    for (const { path: pathParts, value } of leaves) {
      const current = getAt(merged, pathParts)
      if (current !== undefined && current !== value) continue

      const tr = await translateValue(value, locale)
      if (tr && tr !== value) {
        setAt(patch, pathParts, tr)
        translated++
      }
    }

    if (translated > 0) {
      const nextOverride = deepMerge(existingOverride, patch)
      fs.mkdirSync(path.dirname(overridePath), { recursive: true })
      fs.writeFileSync(overridePath, JSON.stringify(nextOverride, null, 2) + '\n')
    }

    console.log(`[i18n:translate-missing] ${locale}/${ns}: ${translated} new translations`)
  }
}

async function main() {
  for (const locale of LOCALES) {
    await processLocale(locale)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
