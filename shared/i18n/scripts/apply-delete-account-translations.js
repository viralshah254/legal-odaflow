#!/usr/bin/env node
/**
 * Merge delete-account page strings into shared/i18n locale legal.json files.
 */
const fs = require('fs')
const path = require('path')

const SHARED = path.join(__dirname, '..')
const BATCH = path.join(SHARED, 'translations/delete-account-translations.json')
const LOCALES = Object.keys(JSON.parse(fs.readFileSync(BATCH, 'utf8')))

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

for (const locale of LOCALES) {
  const legalPath = path.join(SHARED, locale, 'legal.json')
  const patch = JSON.parse(fs.readFileSync(BATCH, 'utf8'))[locale]
  const legal = fs.existsSync(legalPath)
    ? JSON.parse(fs.readFileSync(legalPath, 'utf8'))
    : {}
  Object.assign(legal, patch)
  writeJson(legalPath, legal)
  console.log(`[i18n] patched legal ${locale} (+${Object.keys(patch).length} delete-account keys)`)
}
