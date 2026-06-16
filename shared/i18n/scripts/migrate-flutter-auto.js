#!/usr/bin/env node
/**
 * Auto-wire hardcoded strings in legal_app Dart to AppLocalizations when an
 * exact English value match exists in shared/i18n/en/*.json.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../..')
const EN_DIR = path.join(__dirname, '../en')
const APP_DIR = path.join(ROOT, 'legal_app/lib')

const { toDartKey } = require('./arb-keys')

function flattenToArbKeys(obj, prefix, ns, out) {
  for (const [k, v] of Object.entries(obj)) {
    const rawKey = prefix ? `${prefix}_${k}` : k
    if (typeof v === 'string') {
      out.push({ arbKey: toDartKey(`${ns}_${rawKey}`), value: v, ns })
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      flattenToArbKeys(v, rawKey, ns, out)
    }
  }
}

function buildLookup() {
  const valueToKey = new Map()
  for (const file of fs.readdirSync(EN_DIR).filter((f) => f.endsWith('.json'))) {
    const ns = file.replace('.json', '')
    const data = JSON.parse(fs.readFileSync(path.join(EN_DIR, file), 'utf8'))
    const entries = []
    flattenToArbKeys(data, '', ns, entries)
    for (const entry of entries) {
      if (entry.value.length < 2 || entry.value.length > 150) continue
      if (!valueToKey.has(entry.value)) {
        valueToKey.set(entry.value, entry.arbKey)
      }
    }
  }
  return valueToKey
}

function walkDart(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      walkDart(full, out)
    } else if (entry.isFile() && entry.name.endsWith('.dart') && !entry.name.includes('.g.dart') && !entry.name.includes('app_localizations')) {
      out.push(full)
    }
  }
}

function ensureL10nImport(content) {
  if (content.includes('app_localizations.dart')) return content
  const importLine = "import 'package:umbrella/l10n/app_localizations.dart';\n"
  return importLine + content
}

function ensureL10nVar(content) {
  if (content.includes('AppLocalizations.of(context)')) return content
  const buildMatch = content.match(/Widget build\(BuildContext context\)\s*\{/)
  if (buildMatch) {
    const idx = buildMatch.index + buildMatch[0].length
    return content.slice(0, idx) + '\n    final l10n = AppLocalizations.of(context)!;\n' + content.slice(idx)
  }
  return content
}

function migrateFile(filePath, lookup) {
  let content = fs.readFileSync(filePath, 'utf8')
  let replacements = 0

  content = content.replace(/Text\s*\(\s*'([^']{2,120})'/g, (match, text) => {
    const key = lookup.get(text.trim())
    if (!key) return match
    replacements++
    return `Text(l10n.${key}`
  })

  content = content.replace(/Text\s*\(\s*"([^"]{2,120})"/g, (match, text) => {
    const key = lookup.get(text.trim())
    if (!key) return match
    replacements++
    return `Text(l10n.${key}`
  })

  content = content.replace(/hintText:\s*'([^']{2,120})'/g, (match, text) => {
    const key = lookup.get(text.trim())
    if (!key) return match
    replacements++
    return `hintText: l10n.${key}`
  })

  content = content.replace(/labelText:\s*'([^']{2,120})'/g, (match, text) => {
    const key = lookup.get(text.trim())
    if (!key) return match
    replacements++
    return `labelText: l10n.${key}`
  })

  if (replacements === 0) return 0

  content = ensureL10nImport(content)
  content = ensureL10nVar(content)
  fs.writeFileSync(filePath, content)
  return replacements
}

const lookup = buildLookup()
const files = []
walkDart(path.join(APP_DIR, 'features'), files)

let total = 0
let fileCount = 0
for (const file of files) {
  const n = migrateFile(file, lookup)
  if (n > 0) {
    total += n
    fileCount++
    console.log(`[migrate-flutter] ${path.relative(ROOT, file)}: ${n}`)
  }
}
console.log(`[migrate-flutter] Done: ${total} replacements in ${fileCount} files`)
