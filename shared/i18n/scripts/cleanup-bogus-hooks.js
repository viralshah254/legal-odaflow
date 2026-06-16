#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../..')
const WEB_DIR = path.join(ROOT, 'legal_web')
const BOGUS = /^\s*const (trim|test|then|toLocaleString|toUpperCase|toLowerCase|toast|toggleDoc) = useTranslations\([^)]+\)\s*$/

function walkTsx(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory() && !['node_modules', '.next'].includes(entry.name)) {
      walkTsx(full, out)
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      out.push(full)
    }
  }
}

const files = []
walkTsx(WEB_DIR, files)
let fixed = 0
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const cleaned = lines.filter((line) => !BOGUS.test(line))
  if (cleaned.length !== lines.length) {
    fs.writeFileSync(file, cleaned.join('\n'))
    fixed++
    console.log(`[cleanup] ${path.relative(ROOT, file)}`)
  }
}
console.log(`[cleanup] Removed bogus hooks from ${fixed} files`)
