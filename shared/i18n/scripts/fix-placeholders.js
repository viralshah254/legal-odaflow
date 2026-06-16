#!/usr/bin/env node
/** Restore ICU/ARB placeholder names from English master (e.g. {error} not {Fehler}). */
const fs = require('fs')
const path = require('path')
const { NAMESPACES, TARGET_LOCALES } = require('./namespaces')

const SHARED_I18N = path.join(__dirname, '..')
const OVERRIDES = path.join(__dirname, 'locale-overrides')

function extractPlaceholders(text) {
  const names = []
  const re = /\{([^}]+)\}/g
  let m
  while ((m = re.exec(text)) !== null) names.push(m[1])
  return names
}

function extractDollarVars(text) {
  const names = []
  const re = /\$([a-zA-Z][a-zA-Z0-9_]*)/g
  let m
  while ((m = re.exec(text)) !== null) names.push(m[1])
  return names
}

function alignPlaceholders(enText, locText) {
  const enPh = extractPlaceholders(enText)
  if (!enPh.length) return locText
  let i = 0
  return locText.replace(/\{[^}]+\}/g, () => `{${enPh[i++] || enPh[enPh.length - 1]}}`)
}

function alignDollarVars(enText, locText) {
  const enVars = extractDollarVars(enText)
  if (!enVars.length) return locText
  let i = 0
  return locText.replace(/\$[a-zA-Z\u0900-\u097F][a-zA-Z0-9_\u0900-\u097F]*/g, () => `$${enVars[i++] || enVars[enVars.length - 1]}`)
}

function fixString(enText, locText) {
  let out = locText
  if (enText.includes('{')) out = alignPlaceholders(enText, out)
  if (enText.includes('$')) out = alignDollarVars(enText, out)
  return out
}

function fixTree(en, loc) {
  let changed = false
  for (const [k, ev] of Object.entries(en)) {
    const lv = loc[k]
    if (typeof ev === 'string' && typeof lv === 'string') {
      const fixed = fixString(ev, lv)
      if (fixed !== lv) {
        loc[k] = fixed
        changed = true
      }
    } else if (ev && typeof ev === 'object' && !Array.isArray(ev)) {
      if (!loc[k] || typeof loc[k] !== 'object') loc[k] = {}
      if (fixTree(ev, loc[k])) changed = true
    }
  }
  return changed
}

let total = 0
for (const locale of TARGET_LOCALES) {
  for (const ns of NAMESPACES) {
    const enPath = path.join(SHARED_I18N, 'en', `${ns}.json`)
    if (!fs.existsSync(enPath)) continue
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))
    for (const dir of [path.join(SHARED_I18N, locale), path.join(OVERRIDES, locale)]) {
      const p = path.join(dir, `${ns}.json`)
      if (!fs.existsSync(p)) continue
      const loc = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (fixTree(en, loc)) {
        fs.writeFileSync(p, JSON.stringify(loc, null, 2) + '\n')
        total++
        console.log(`[fix-placeholders] ${path.relative(SHARED_I18N, p)}`)
      }
    }
  }
}
console.log(`[fix-placeholders] ${total} files patched`)
