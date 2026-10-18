#!/usr/bin/env node
/**
 * Merge unified auth and password policy strings into each locale auth.json file.
 */
const fs = require('fs')
const path = require('path')

const SHARED = path.join(__dirname, '..')
const BATCH = path.join(SHARED, 'translations/auth-unified-translations.json')
const LOCALES = Object.keys(JSON.parse(fs.readFileSync(BATCH, 'utf8')))

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

for (const locale of LOCALES) {
  const authPath = path.join(SHARED, locale, 'auth.json')
  const patch = JSON.parse(fs.readFileSync(BATCH, 'utf8'))[locale]
  const auth = fs.existsSync(authPath)
    ? JSON.parse(fs.readFileSync(authPath, 'utf8'))
    : {}
  Object.assign(auth, patch)
  writeJson(authPath, auth)
  console.log(`[i18n] patched auth ${locale} (+${Object.keys(patch).length} keys)`)
}
