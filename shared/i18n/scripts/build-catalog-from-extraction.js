#!/usr/bin/env node
/**
 * Merge extraction candidates into shared/i18n/en/*.json with slugified keys.
 * Skips strings already present as values. Run after extract-candidates.js.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../..')
const CANDIDATES = path.join(__dirname, '../extraction/candidates.json')
const EN_DIR = path.join(__dirname, '../en')

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 60) || 'text'
}

function collectValues(obj, out = new Set()) {
  if (typeof obj === 'string') {
    out.add(obj)
    return out
  }
  for (const v of Object.values(obj)) collectValues(v, out)
  return out
}

function collectKeys(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out.add(p)
    else collectKeys(v, p, out)
  }
  return out
}

function setNested(obj, keyPath, value) {
  const parts = keyPath.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}
    cur = cur[parts[i]]
  }
  cur[parts[parts.length - 1]] = value
}

function loadNs(ns) {
  const p = path.join(EN_DIR, `${ns}.json`)
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {}
}

function saveNs(ns, data) {
  fs.writeFileSync(path.join(EN_DIR, `${ns}.json`), JSON.stringify(data, null, 2) + '\n')
}

if (!fs.existsSync(CANDIDATES)) {
  console.error('[build-catalog] Run extract-candidates.js first')
  process.exit(1)
}

const summary = JSON.parse(fs.readFileSync(CANDIDATES, 'utf8'))
let added = 0

for (const [ns, strings] of Object.entries(summary.byNamespace)) {
  const data = loadNs(ns)
  const existingValues = collectValues(data)
  const existingKeys = collectKeys(data)
  const usedSlugs = new Set([...existingKeys].map((k) => k.split('.').pop()))

  for (const text of strings) {
    if (existingValues.has(text)) continue
    if (text.length < 2 || text.length > 200) continue
    if (/[\n{}<>]/.test(text)) continue
    if (/useState|useEffect|className|import /.test(text)) continue
    if (/^https?:\/\//.test(text)) continue
    if (/^\d+$/.test(text)) continue

    let slug = slugify(text)
    let n = 2
    while (usedSlugs.has(slug)) {
      slug = `${slugify(text)}_${n++}`
    }
    usedSlugs.add(slug)
    setNested(data, slug, text)
    existingValues.add(text)
    added++
  }
  saveNs(ns, data)
}

console.log(`[build-catalog] Added ${added} new keys to en/*.json`)
