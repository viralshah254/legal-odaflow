#!/usr/bin/env node
/** Patch remaining mixed-locale catalog entries with alternate phrasing / hi pivot. */
const fs = require('fs')
const path = require('path')
const { NAMESPACES } = require('./namespaces')
const { translateTextAsync, hasMixedIndicLatin } = require('./translation-engine')

const SHARED = path.join(__dirname, '..')
const CATALOG = path.join(SHARED, 'translations/catalog')
const VIOLATIONS = path.join(SHARED, 'extraction/mixed-locale-violations.json')

function getByPath(obj, keyPath) {
  return keyPath.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)
}

function loadEn() {
  const maps = {}
  for (const ns of NAMESPACES) {
    maps[ns] = JSON.parse(fs.readFileSync(path.join(SHARED, 'en', `${ns}.json`), 'utf8'))
  }
  return maps
}

const ALT = {
  'Draft a client status update for [Matter]': 'Draft a client status update for the case',
  'View All Matters:': 'See all cases:',
}

async function main() {
  const { violations } = JSON.parse(fs.readFileSync(VIOLATIONS, 'utf8'))
  const enMaps = loadEn()
  const hiCat = JSON.parse(fs.readFileSync(path.join(CATALOG, 'hi.json'), 'utf8'))
  let fixed = 0

  for (const v of violations) {
    let en = getByPath(enMaps[v.namespace], v.key)
    if (!en) continue
    const alt = ALT[en] || en
    const catalogPath = path.join(CATALOG, `${v.locale}.json`)
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))

    let tr = await translateTextAsync(alt, v.locale, { delay: 100 })
    if (hasMixedIndicLatin(tr) && hiCat[en]) {
      tr = await translateTextAsync(hiCat[en], v.locale, { delay: 100 })
    }
    if (!tr || tr === en || hasMixedIndicLatin(tr)) {
      console.warn(`[patch-mixed] skip ${v.locale} ${v.key}`)
      continue
    }
    catalog[en] = tr
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n')
    fixed++
    console.log(`[patch-mixed] ${v.locale} ${v.key}`)
  }
  console.log(`[patch-mixed] ${fixed} patched`)
}

main().catch((e) => { console.error(e); process.exit(1) })
