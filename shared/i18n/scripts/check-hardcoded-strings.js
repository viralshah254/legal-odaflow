#!/usr/bin/env node
/**
 * Fail CI when user-facing English strings are hardcoded instead of i18n keys.
 * - legal_web TSX files: JSX text nodes with ASCII letters
 * - legal_app/lib/features Dart files: Text('...') with ASCII letters
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../..')
const WEB_DIR = path.join(ROOT, 'legal_web')
const DART_DIRS = [
  path.join(ROOT, 'legal_app/lib/features'),
  path.join(ROOT, 'legal_app/lib/core'),
  path.join(ROOT, 'legal_app/lib/widgets'),
]

const JSX_TEXT_RE = />([^<{][^<>{}\n]{1,200})</g
const DART_TEXT_RE = /Text\s*\(\s*(['"])((?:\\.|(?!\1).)*)\1/g
const TOAST_TITLE_RE = /toast\s*\(\s*\{[^}]*title:\s*(['"])([^'"]{2,120})\1/g
const PROP_LITERAL_RE = /\b(title|label|placeholder|description|aria-label|hintText|labelText)\s*=\s*(['"])([^'"]{2,120})\2/g
const DART_PROP_RE = /\b(labelText|hintText|helperText|tooltip):\s*(['"])([^'"]{2,120})\2/g
const DART_TAB_RE = /Tab\s*\(\s*text:\s*(['"])([^'"]{2,80})\1/g
const DART_VALIDATOR_RE = /return\s*(['"])([^'"]{2,120})\1\s*;?\s*$/gm

const ALLOWED_WEB = [
  /^[\d\s.,:;!?%$#@&*()\-–—/\\+|…]+$/,
  /^[a-z]+(-[a-z0-9]+)+$/, // tailwind / css tokens
  /^v\d+(\.\d+)?$/,
  /^[A-Z]{2,5}$/, // country codes, API enums
  /^[•·…]+$/,
  /^&[a-z]+;$/i,
  /^https?:\/\//,
  /^\/[a-z0-9/_-]+$/i,
  /^[a-f0-9-]{36}$/i, // uuids
  /^L\d+\s*\/\s*I\d+$/, // likelihood badges
  /^GET\s+\//,
  /^POST\s+\//,
  /^PUT\s+\//,
  /^DELETE\s+\//,
  /^X-[A-Za-z-]+:/,
]

const CODE_FRAGMENTS = [
  /^[=<>!]/,
  /\&\&/,
  /\?\./,
  /\?\?/,
  /=>/,
  /\bPromise\b/,
  /\breturn\b/,
  /\btype\s+\w+/,
  /\bRecord\b/,
  /\bapiFetch\b/,
  /\binsertHTML\b/,
  /\bz\.infer\b/,
  /\$\{/,
  /\$\w+/,
  /\bvoid\b/,
  /\basync\b/,
  /\bconst\b/,
  /\blet\b/,
  /\bvar\b/,
  /\bfunction\b/,
  /\binterface\b/,
  /\bclass\b/,
  /\bextends\b/,
  /\bimplements\b/,
  /\bnull\b/,
  /\bundefined\b/,
  /\btrue\b/,
  /\bfalse\b/,
  /\bsplit\s*\(/,
  /\btoStringAsFixed\b/,
  /\breplaceAll\b/,
  /\bl10n\./,
]

function hasAsciiLetters(text) {
  return /[A-Za-z]/.test(text)
}

function isCodeLike(text) {
  if (CODE_FRAGMENTS.some((re) => re.test(text))) return true
  if (text.includes('===') || text.includes('new Date')) return true
  if (text.includes('return') && text.includes('(')) return true
  if (/^[a-z]+\.[a-zA-Z]+/.test(text)) return true
  if (/^[A-Za-z_]+$/.test(text) && text.length <= 12) return true // identifiers
  if (text.length <= 3 && /^[A-Za-z]+$/.test(text)) return true
  return false
}

function isAllowedWeb(text) {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length < 2) return true
  if (trimmed.startsWith('{') || trimmed.includes('${')) return true
  if (!hasAsciiLetters(trimmed)) return true
  if (isCodeLike(trimmed)) return true
  return ALLOWED_WEB.some((re) => re.test(trimmed))
}

function isAllowedDart(text) {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length < 2) return true
  if (!hasAsciiLetters(trimmed)) return true
  if (isCodeLike(trimmed)) return true
  if (trimmed.includes('$')) return true
  if (/^\$\{/.test(trimmed)) return true
  return false
}

function walk(dir, ext, out, skipDirs = []) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (skipDirs.includes(entry.name)) continue
      walk(full, ext, out, skipDirs)
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      out.push(full)
    }
  }
}

function scanWebProps(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const hits = []
  for (const re of [TOAST_TITLE_RE, PROP_LITERAL_RE]) {
    let m
    const regex = new RegExp(re.source, re.flags)
    while ((m = regex.exec(content)) !== null) {
      const text = m[m.length - 1].trim()
      const lineStart = content.lastIndexOf('\n', m.index) + 1
      const lineEnd = content.indexOf('\n', m.index)
      const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd)
      if (/\bt\s*\(|useTranslations|getTranslations|l10n\./.test(line)) continue
      if (!isAllowedWeb(text)) {
        hits.push({ text, line: content.slice(0, m.index).split('\n').length })
      }
    }
  }
  return hits
}

function scanWeb(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const hits = []
  let m
  const re = new RegExp(JSX_TEXT_RE.source, JSX_TEXT_RE.flags)
  while ((m = re.exec(content)) !== null) {
    const before = content.slice(Math.max(0, m.index - 80), m.index)
    if (/sr-only[^>]*$/.test(before)) continue
    const lineStart = content.lastIndexOf('\n', m.index) + 1
    const lineEnd = content.indexOf('\n', m.index)
    const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd)
    if (/\bt\s*\(|useTranslations|getTranslations/.test(line)) continue
    const text = m[1].trim()
    if (!isAllowedWeb(text)) {
      hits.push({ text, line: content.slice(0, m.index).split('\n').length })
    }
  }
  hits.push(...scanWebProps(filePath))
  return hits
}

function scanDartExtras(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const hits = []
  for (const re of [DART_PROP_RE, DART_TAB_RE]) {
    let m
    const regex = new RegExp(re.source, re.flags)
    while ((m = regex.exec(content)) !== null) {
      const text = m[m.length - 1].trim()
      if (!isAllowedDart(text)) {
        hits.push({ text, line: content.slice(0, m.index).split('\n').length })
      }
    }
  }
  return hits
}

function scanDart(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const hits = []
  let m
  const re = new RegExp(DART_TEXT_RE.source, DART_TEXT_RE.flags)
  while ((m = re.exec(content)) !== null) {
    const text = m[2].trim()
    if (!isAllowedDart(text)) {
      hits.push({ text, line: content.slice(0, m.index).split('\n').length })
    }
  }
  hits.push(...scanDartExtras(filePath))
  return hits
}

const webFiles = []
walk(WEB_DIR, '.tsx', webFiles, ['node_modules', '.next'])
const dartFiles = []
for (const dir of DART_DIRS) {
  walk(dir, '.dart', dartFiles, [])
}

const violations = []

for (const file of webFiles) {
  if (file.includes('.test.')) continue
  const hits = scanWeb(file)
  if (hits.length) {
    violations.push({ file: path.relative(ROOT, file), hits })
  }
}

for (const file of dartFiles) {
  if (file.includes('.g.dart') || file.includes('app_localizations')) continue
  const hits = scanDart(file)
  if (hits.length) {
    violations.push({ file: path.relative(ROOT, file), hits })
  }
}

if (violations.length === 0) {
  console.log('[i18n:hardcoded] OK — no hardcoded user-facing strings detected')
  process.exit(0)
}

const warnOnly = process.argv.includes('--warn')

if (warnOnly) {
  let total = violations.reduce((a, v) => a + v.hits.length, 0)
  console.warn(`[i18n:hardcoded] WARN: ${total} hardcoded strings in ${violations.length} files (non-blocking)`)
  process.exit(0)
}

let total = 0
for (const v of violations) {
  console.error(`[i18n:hardcoded] ${v.file}`)
  for (const hit of v.hits.slice(0, 5)) {
    console.error(`  L${hit.line}: "${hit.text}"`)
    total++
  }
  if (v.hits.length > 5) {
    console.error(`  ... +${v.hits.length - 5} more`)
    total += v.hits.length - 5
  }
}
console.error(`[i18n:hardcoded] FAILED: ${total} hardcoded strings in ${violations.length} files`)
process.exit(1)
