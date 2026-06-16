#!/usr/bin/env node
/** Remove junk keys from en/*.json added by over-aggressive extraction. */
const fs = require('fs')
const path = require('path')

const EN_DIR = path.join(__dirname, '../en')

const JUNK_VALUE = [
  /\n/,
  /useState/,
  /useEffect/,
  /const \[/,
  /^\(\[\]\)/,
  /^[a-z_]+\(/,
  /^[{}[\]]/,
  /className=/,
  /import /,
]

const JUNK_KEY = [
  /^const_/,
  /usestate$/i,
  /classname/i,
]

function isJunk(key, value) {
  if (typeof value !== 'string') return true
  if (value.length < 2 || value.length > 200) return true
  if (JUNK_KEY.some((r) => r.test(key))) return true
  if (JUNK_VALUE.some((r) => r.test(value))) return true
  return false
}

function clean(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return obj
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      if (!isJunk(k, v)) out[k] = v
    } else {
      const nested = clean(v)
      if (nested && Object.keys(nested).length > 0) out[k] = nested
    }
  }
  return out
}

let removed = 0
for (const file of fs.readdirSync(EN_DIR).filter((f) => f.endsWith('.json'))) {
  const p = path.join(EN_DIR, file)
  const before = JSON.stringify(JSON.parse(fs.readFileSync(p, 'utf8')))
  const data = clean(JSON.parse(fs.readFileSync(p, 'utf8')))
  const after = JSON.stringify(data)
  removed += (before.match(/":/g) || []).length - (after.match(/":/g) || []).length
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n')
}
console.log(`[sanitize-catalog] Removed ~${removed} junk entries`)
