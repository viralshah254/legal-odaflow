#!/usr/bin/env node
/**
 * Translate legal_web/messages keys that still match English (pending fallbacks).
 * Uses shared/i18n translation-engine (Google Translate + phrase maps).
 * Preserves {placeholders}, $vars, and <tags>.
 */
const fs = require('fs')
const path = require('path')
const { translateTextAsync } = require('../../shared/i18n/scripts/translation-engine')
const { isAllowlisted } = require('../../shared/i18n/scripts/check-translation-coverage')

const MESSAGES_DIR = path.join(__dirname, '../messages')
const LOCALES = fs
  .readdirSync(MESSAGES_DIR)
  .filter((f) => f.endsWith('.json') && f !== 'en.json')
  .map((f) => f.replace('.json', ''))

const localeFilter = process.argv.find((a) => a.startsWith('--locale='))?.split('=')[1]
const nsFilter = process.argv.find((a) => a.startsWith('--namespace='))?.split('=')[1]
const dryRun = process.argv.includes('--dry-run')

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

function unmaskPlaceholders(text, store) {
  return text.replace(/\uE000(\d+)\uE001/g, (_, i) => store[Number(i)] ?? '')
}

function alignPlaceholders(enText, locText) {
  const names = [...enText.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])
  if (!names.length) return locText
  let i = 0
  return locText.replace(/\{[^}]+\}/g, () => `{${names[i++] ?? names[names.length - 1]}}`)
}

function shouldTranslate(enVal, locVal, keyPath) {
  if (typeof enVal !== 'string' || typeof locVal !== 'string') return false
  if (locVal !== enVal) return false
  if (isAllowlisted(enVal)) return false
  if (nsFilter && !keyPath.startsWith(nsFilter + '.') && keyPath !== nsFilter) return false
  if (enVal.trim().length === 0) return false
  return true
}

async function translateLeaf(enVal, locale) {
  const { masked, store } = maskPlaceholders(enVal)
  const translated = await translateTextAsync(masked, locale, { delay: 35 })
  let out = unmaskPlaceholders(translated, store)
  out = alignPlaceholders(enVal, out)
  if (!out.trim() || out === enVal) return null
  return out
}

async function walkTranslate(enNode, locNode, locale, keyPath, stats) {
  if (typeof enNode === 'string') {
    if (!shouldTranslate(enNode, locNode, keyPath)) return
    stats.pending++
    if (dryRun) return
    const translated = await translateLeaf(enNode, locale)
    if (translated) {
      stats.translated++
      return translated
    }
    stats.skipped++
    return
  }

  if (Array.isArray(enNode)) {
    const out = Array.isArray(locNode) ? locNode : []
    for (let i = 0; i < enNode.length; i++) {
      const result = await walkTranslate(enNode[i], out[i], locale, `${keyPath}.${i}`, stats)
      if (typeof result === 'string') out[i] = result
    }
    return out
  }

  if (enNode && typeof enNode === 'object') {
    for (const key of Object.keys(enNode)) {
      const childPath = keyPath ? `${keyPath}.${key}` : key
      const result = await walkTranslate(enNode[key], locNode?.[key], locale, childPath, stats)
      if (typeof result === 'string') locNode[key] = result
      else if (result && typeof result === 'object') locNode[key] = result
    }
  }
}

async function translateLocale(locale) {
  const en = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, 'en.json'), 'utf8'))
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
  const loc = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const stats = { pending: 0, translated: 0, skipped: 0 }

  await walkTranslate(en, loc, locale, '', stats)

  if (!dryRun && stats.translated > 0) {
    fs.writeFileSync(filePath, JSON.stringify(loc, null, 2) + '\n')
  }

  console.log(
    `[translate-pending] ${locale}: ${stats.translated} translated, ${stats.skipped} skipped, ${stats.pending} pending${dryRun ? ' (dry-run)' : ''}`,
  )
}

async function main() {
  const targets = localeFilter ? [localeFilter] : LOCALES
  for (const locale of targets) {
    await translateLocale(locale)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
