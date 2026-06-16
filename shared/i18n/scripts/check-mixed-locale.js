#!/usr/bin/env node
/**
 * Detect mixed-language translation values (e.g. English UI words + Indic script).
 * Focuses on common English leakage, not legitimate loanwords (KPI, SSO, PDF, etc.).
 */
const fs = require('fs')
const path = require('path')
const { NAMESPACES, TARGET_LOCALES } = require('./namespaces')

const SHARED_I18N = path.join(__dirname, '..')
const OUT = path.join(SHARED_I18N, 'extraction/mixed-locale-violations.json')
const strict = process.argv.includes('--strict')

const INDIC = /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0600-\u06FF]/
const LATIN_WORD = /\b[A-Za-z]{3,}\b/i

/** English UI words that should not appear in Indic/Urdu UI strings. */
const BAD_UI_WORDS = new Set([
  'the', 'and', 'with', 'this', 'that', 'from', 'your', 'for', 'are', 'was', 'were',
  'have', 'not', 'can', 'could', 'would', 'should', 'will', 'new', 'start',
  'people', 'access', 'failed', 'load', 'create', 'search', 'name', 'email', 'other',
  'found', 'results', 'result', 'pending', 'payment', 'training', 'charges', 'countries',
  'jurisdiction', 'matter', 'client', 'clients', 'could', 'nothing', 'there', 'any',
  'when', 'where', 'what', 'who', 'how', 'all', 'mark', 'intellectual', 'property',
  'default', 'before', 'after', 'into', 'about', 'over', 'under', 'between', 'through',
  'please', 'try', 'again', 'error', 'success', 'warning', 'delete', 'update', 'view',
  'open', 'close', 'save', 'cancel', 'submit', 'send', 'add', 'remove', 'edit', 'back',
])

function collectLeaves(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      collectLeaves(v, p, out)
    } else if (typeof v === 'string') {
      out.push({ path: p, value: v })
    }
  }
  return out
}

function normalizeForCheck(value) {
  if (/^\{[\w.]+\s*,\s*plural,/.test(value)) return ''
  let s = value
  s = s.replace(/<[^>]+>/g, ' ')
  s = s.replace(/\{[^}]+\}/g, ' ')
  s = s.replace(/\$[a-zA-Z][a-zA-Z0-9_]*/g, ' ')
  s = s.replace(/\{#[^}]+\}/g, ' ')
  s = s.replace(/\b(?:yyyy|MM|dd|HH|mm|ss)\b/g, ' ')
  s = s.replace(/[⌘⇧⌥⌃+\-]/g, ' ')
  return s.trim()
}

function isMixed(value) {
  if (!INDIC.test(value)) return false
  if (/\{\w+,\s*plural,\s*one/.test(value)) {
    const before = value.split(/\{\w+,\s*plural/)[0]
    const after = value.slice(value.lastIndexOf('}') + 1)
    return isMixedFragment(before) || isMixedFragment(after)
  }
  return isMixedFragment(value)
}

function isMixedFragment(value) {
  const stripped = normalizeForCheck(value)
  if (!stripped) return false
  const words = stripped.match(LATIN_WORD)
  if (!words) return false
  const bad = words.filter((w) => BAD_UI_WORDS.has(w.toLowerCase()))
  return bad.length > 0
}

const violations = []

for (const locale of TARGET_LOCALES) {
  for (const ns of NAMESPACES) {
    const file = path.join(SHARED_I18N, locale, `${ns}.json`)
    if (!fs.existsSync(file)) continue
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    for (const { path: keyPath, value } of collectLeaves(data)) {
      if (isMixed(value)) {
        violations.push({ locale, namespace: ns, key: keyPath, value })
      }
    }
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), count: violations.length, violations }, null, 2) + '\n')
console.log(`[i18n:mixed] ${violations.length} mixed-locale string(s) → ${path.relative(process.cwd(), OUT)}`)

if (strict && violations.length > 0) {
  for (const v of violations.slice(0, 20)) {
    console.error(`  ${v.locale}/${v.namespace}.${v.key}: "${v.value.slice(0, 80)}…"`)
  }
  if (violations.length > 20) console.error(`  … and ${violations.length - 20} more`)
  process.exit(1)
}
