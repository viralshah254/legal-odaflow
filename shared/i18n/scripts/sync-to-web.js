#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { NAMESPACES, FILE_TO_NS } = require('./namespaces')

const ROOT = path.join(__dirname, '../../..')
const SHARED_I18N = path.join(__dirname, '..')
const WEB_MESSAGES = path.join(ROOT, 'legal_web/messages')

function getLocaleDirs() {
  return fs
    .readdirSync(SHARED_I18N, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !['scripts', 'extraction', 'translations'].includes(d.name))
    .map((d) => d.name)
}

function loadNamespace(locale, ns) {
  const filePath = path.join(SHARED_I18N, locale, `${ns}.json`)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function syncLocale(locale) {
  const merged = {}
  for (const ns of NAMESPACES) {
    const data = loadNamespace(locale, ns)
    if (data) merged[FILE_TO_NS[ns] || ns] = data
  }
  fs.mkdirSync(WEB_MESSAGES, { recursive: true })
  const outPath = path.join(WEB_MESSAGES, `${locale}.json`)
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n')
  console.log(`[i18n:sync-web] ${locale} → ${path.relative(ROOT, outPath)}`)
}

for (const locale of getLocaleDirs()) syncLocale(locale)
