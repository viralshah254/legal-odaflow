#!/usr/bin/env node
/** Restore ICU plural keyword `other` and full plural structure from English master. */
const fs = require('fs')
const path = require('path')
const { NAMESPACES, TARGET_LOCALES } = require('./namespaces')

const SHARED_I18N = path.join(__dirname, '..')
const OVERRIDES = path.join(__dirname, 'locale-overrides')

const VALID_PLURAL = /\{(\w+),\s*plural,\s*one \{([^}]+)\} other \{([^}]+)\}\}/

function fixIcuKeyword(text) {
  if (!text.includes('plural,')) return text
  return text.replace(/(\{[\w.]+,\s*plural,\s*)\S+(\s*\{[^}]+\})\s+\S+(\s*\{)/g, '$1one$2 other$3')
}

function sanitizeIcuFromEn(enText, text) {
  if (!text.includes('plural')) return text
  let s = text.replace(/\u060C/g, ',')
  const enVar = enText.match(/\{(\w+),\s*plural/)?.[1]
  if (enVar) s = s.replace(/\{(\S+),\s*plural/g, `{${enVar}, plural`)
  return fixIcuKeyword(s)
}

function extractPluralBlock(text) {
  const m = text.match(VALID_PLURAL)
  return m ? { one: m[2], other: m[3] } : null
}

function needsCatalogFix(enText, locText) {
  if (enText === locText) return true
  const block = extractPluralBlock(enText)
  if (!block) return false
  return locText.includes(block.one) || locText.includes(block.other)
}

function catalogHasValidPlural(enText, candidate) {
  if (!candidate || candidate === enText) return false
  if (/\bis missing\b|\bhas \{count/.test(candidate)) return false
  return /\{count,\s*plural,\s*one\s*\{/.test(candidate)
}

function restorePluralFromEn(enText, locText) {
  if (/\{\w+,\s*plural,\s*one\s*\{/.test(locText)) return fixIcuKeyword(locText)
  const enMatch = enText.match(VALID_PLURAL)
  if (!enMatch) return locText
  if (VALID_PLURAL.test(locText)) return fixIcuKeyword(locText)

  const [, varName, oneEn, otherEn] = enMatch
  const prefix = enText.slice(0, enMatch.index)
  const suffix = enText.slice(enMatch.index + enMatch[0].length)

  const inners = [...locText.matchAll(/\{#\s*([^}]+)\}/g)].map((m) => m[1].trim())
  const oneInner = inners[0] || oneEn.replace(/^#\s*/, '')
  const otherInner = inners[1] || otherEn.replace(/^#\s*/, '')
  const plural = `{${varName}, plural, one {# ${oneInner}} other {# ${otherInner}}}`

  const pluralIdx = locText.search(/\{\w+,\s*plural/)
  const locPrefix = pluralIdx > 0 ? locText.slice(0, pluralIdx) : prefix
  const locSuffix = locText.includes('}') ? locText.slice(locText.lastIndexOf('}') + 1) : suffix

  return `${locPrefix}${plural}${locSuffix}`
}

function fixTree(en, loc, locale) {
  let changed = false
  for (const [k, ev] of Object.entries(en)) {
    const lv = loc[k]
    if (typeof ev === 'string' && typeof lv === 'string') {
      let fixed = lv
      if (needsCatalogFix(ev, lv)) {
        const catalogPath = path.join(SHARED_I18N, 'translations/catalog', `${locale}.json`)
        if (fs.existsSync(catalogPath)) {
          const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
          const candidate = catalog[ev]
          if (catalogHasValidPlural(ev, candidate)) {
            fixed = candidate
          }
        }
      } else {
        fixed = restorePluralFromEn(ev, lv)
      }
      fixed = fixIcuKeyword(fixed)
      fixed = sanitizeIcuFromEn(ev, fixed)
      if (fixed !== lv) {
        loc[k] = fixed
        changed = true
      }
    } else if (ev && typeof ev === 'object' && !Array.isArray(ev)) {
      if (!loc[k] || typeof loc[k] !== 'object') loc[k] = {}
      if (fixTree(ev, loc[k], locale)) changed = true
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
      if (fixTree(en, loc, locale)) {
        fs.writeFileSync(p, JSON.stringify(loc, null, 2) + '\n')
        total++
        console.log(`[fix-icu] ${path.relative(SHARED_I18N, p)}`)
      }
    }
  }
}
console.log(`[fix-icu] ${total} files patched`)
