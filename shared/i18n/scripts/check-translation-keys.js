#!/usr/bin/env node
/**
 * Validate that t("key") / t.raw("key") paths resolve in shared/i18n/en/*.json.
 */
const fs = require('fs')
const path = require('path')
const { NAMESPACES } = require('./namespaces')

const ROOT = path.join(__dirname, '../../..')
const WEB_DIR = path.join(ROOT, 'legal_web')
const EN_DIR = path.join(__dirname, '..', 'en')

function flatten(obj, prefix = '') {
  const out = new Set()
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const sub of flatten(v, p)) out.add(sub)
    } else {
      out.add(p)
    }
  }
  return out
}

function loadCatalog() {
  const catalog = {}
  for (const ns of NAMESPACES) {
    const file = path.join(EN_DIR, `${ns}.json`)
    if (!fs.existsSync(file)) continue
    catalog[ns] = flatten(JSON.parse(fs.readFileSync(file, 'utf8')))
  }
  return catalog
}

function walkTsx(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next') continue
      walkTsx(full, out)
    } else if (ent.name.endsWith('.tsx') && !ent.name.endsWith('.test.tsx')) {
      out.push(full)
    }
  }
  return out
}

function resolveKey(catalog, namespace, key) {
  const parts = namespace.split('.')
  const baseNs = parts[0]
  const subPath = parts.slice(1).join('.')
  const fullKey = subPath ? `${subPath}.${key}` : key
  if (catalog[baseNs]?.has(fullKey)) return true
  if (catalog[baseNs]?.has(key)) return true
  return false
}

function extractUsages(content, filePath) {
  const usages = []
  const aliases = {}
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const assign = line.match(/const\s+(\w+)\s*=\s*useTranslations\s*\(\s*["']([^"']+)["']\s*\)/)
    if (assign) aliases[assign[1]] = assign[2]

    for (const m of line.matchAll(/\b(\w+)\(\s*["']([^"']+)["']/g)) {
      const fn = m[1]
      if (!aliases[fn]) continue
      if (fn === 'toast' || fn === 'format' || fn === 'test' || fn === 'toISOString' || fn === 'toLocaleDateString') continue
      usages.push({ file: filePath, line: i + 1, ns: aliases[fn], key: m[2], fn })
    }

    for (const m of line.matchAll(/\b(\w+)\.raw\s*\(\s*["']([^"']+)["']/g)) {
      const fn = m[1]
      if (!aliases[fn]) continue
      usages.push({ file: filePath, line: i + 1, ns: aliases[fn], key: m[2], fn: `${fn}.raw` })
    }
  }

  return usages
}

const catalog = loadCatalog()
const files = walkTsx(WEB_DIR)
const missing = []

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8')
  if (!content.includes('useTranslations')) continue
  const usages = extractUsages(content, path.relative(ROOT, file))
  for (const u of usages) {
    if (!resolveKey(catalog, u.ns, u.key)) {
      missing.push(u)
    }
  }
}

if (missing.length) {
  console.error(`[i18n:keys] FAILED: ${missing.length} unresolved translation key(s)`)
  for (const m of missing.slice(0, 50)) {
    console.error(`  ${m.file}:${m.line}  ${m.ns}.${m.key}  (${m.fn})`)
  }
  if (missing.length > 50) console.error(`  … and ${missing.length - 50} more`)
  process.exit(1)
}

console.log(`[i18n:keys] OK (${files.length} files scanned)`)
