#!/usr/bin/env node
/**
 * Batch-translate all unique English strings via Google Translate (free endpoint)
 * into shared/i18n/translations/catalog/{locale}.json
 */
const fs = require('fs')
const path = require('path')
const { NAMESPACES, TARGET_LOCALES } = require('./namespaces')
const { translateTextAsync } = require('./translation-engine')

const SHARED_I18N = path.join(__dirname, '..')
const CATALOG_DIR = path.join(SHARED_I18N, 'translations/catalog')
const CONCURRENCY = parseInt(process.env.I18N_CATALOG_CONCURRENCY || '12', 10)

function collectStrings(obj, out = new Set()) {
  for (const v of Object.values(obj)) {
    if (typeof v === 'string') out.add(v)
    else if (v && typeof v === 'object' && !Array.isArray(v)) collectStrings(v, out)
  }
  return out
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

async function mapPool(items, fn, limit) {
  const results = new Array(items.length)
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

const allStrings = new Set()
for (const ns of NAMESPACES) {
  const p = path.join(SHARED_I18N, 'en', `${ns}.json`)
  if (fs.existsSync(p)) collectStrings(JSON.parse(fs.readFileSync(p, 'utf8')), allStrings)
}

const localeFilter = process.argv.find((a) => a.startsWith('--locales='))?.split('=')[1]?.split(',')
const locales = localeFilter || TARGET_LOCALES
const force = process.argv.includes('--force')

async function translateOne(text, locale) {
  const { text: prot, tokens } = protectPlaceholders(text)
  try {
    let tr = await translateTextAsync(prot, locale, { delay: 0 })
    tr = restorePlaceholders(tr, tokens)
    if (tr && tr.trim()) return tr
  } catch {
    /* fall through */
  }
  return text
}

async function buildLocale(locale) {
  const catalogPath = path.join(CATALOG_DIR, `${locale}.json`)
  const catalog = force ? {} : fs.existsSync(catalogPath) ? JSON.parse(fs.readFileSync(catalogPath, 'utf8')) : {}
  const sorted = [...allStrings].sort()
  const pending = sorted.filter((t) => !catalog[t] || force)

  if (pending.length === 0) {
    console.log(`[i18n:catalog] ${locale}: ${Object.keys(catalog).length} total (cached)`)
    return
  }

  let done = 0
  await mapPool(
    pending,
    async (text) => {
      catalog[text] = await translateOne(text, locale)
      done++
      if (done % 100 === 0 || done === pending.length) {
        fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n')
        process.stdout.write(`[i18n:catalog] ${locale}: ${done}/${pending.length}\n`)
      }
    },
    CONCURRENCY,
  )

  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n')
  console.log(`[i18n:catalog] ${locale}: ${pending.length} new, ${Object.keys(catalog).length} total`)
}

async function main() {
  fs.mkdirSync(CATALOG_DIR, { recursive: true })
  const localeConcurrency = parseInt(process.env.I18N_LOCALE_CONCURRENCY || '3', 10)
  await mapPool(locales, (locale) => buildLocale(locale), localeConcurrency)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
