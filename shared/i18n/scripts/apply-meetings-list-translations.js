#!/usr/bin/env node
/**
 * Merge meetings list filter/scope/date strings into each locale common.json file.
 */
const fs = require('fs')
const path = require('path')

const SHARED = path.join(__dirname, '..')
const BATCH = path.join(SHARED, 'translations/meetings-list-translations.json')
const LOCALES = Object.keys(JSON.parse(fs.readFileSync(BATCH, 'utf8')))

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

for (const locale of LOCALES) {
  const commonPath = path.join(SHARED, locale, 'common.json')
  const patch = JSON.parse(fs.readFileSync(BATCH, 'utf8'))[locale]
  const common = fs.existsSync(commonPath)
    ? JSON.parse(fs.readFileSync(commonPath, 'utf8'))
    : {}
  Object.assign(common, patch)
  writeJson(commonPath, common)
  console.log(`[i18n] patched common ${locale} (+${Object.keys(patch).length} keys)`)
}
