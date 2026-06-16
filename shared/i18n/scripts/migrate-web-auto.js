#!/usr/bin/env node
/**
 * Auto-wire hardcoded strings in legal_web TSX to next-intl when an exact
 * English value match exists in shared/i18n/en/*.json.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../..')
const EN_DIR = path.join(__dirname, '../en')
const WEB_DIR = path.join(ROOT, 'legal_web')

function flatten(obj, prefix = '', ns = '') {
  const out = []
  for (const [k, v] of Object.entries(obj)) {
    const keyPath = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') {
      out.push({ ns, key: keyPath, value: v })
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flatten(v, keyPath, ns))
    }
  }
  return out
}

function buildLookup() {
  const valueToKey = new Map()
  for (const file of fs.readdirSync(EN_DIR).filter((f) => f.endsWith('.json'))) {
    const ns = file.replace('.json', '')
    const data = JSON.parse(fs.readFileSync(path.join(EN_DIR, file), 'utf8'))
    for (const entry of flatten(data, '', ns)) {
      if (entry.value.length < 2 || entry.value.length > 150) continue
      if (!valueToKey.has(entry.value)) {
        valueToKey.set(entry.value, entry)
      }
    }
  }
  return valueToKey
}

function suggestNs(filePath) {
  if (filePath.includes('/auth/')) return 'auth'
  if (filePath.includes('/dashboard/')) return 'dashboard'
  if (filePath.includes('/matters/')) return 'matters'
  if (filePath.includes('/clients/')) return 'clients'
  if (filePath.includes('/billing/') || filePath.includes('/finance/') || filePath.includes('/accounting/')) return 'billing'
  if (filePath.includes('/copilot/')) return 'copilot'
  if (filePath.includes('/issue-checker/')) return 'issueChecker'
  if (filePath.includes('/consumer/')) return 'consumer'
  if (filePath.includes('/admin/')) return 'admin'
  if (filePath.includes('/portal/')) return 'portal'
  if (filePath.includes('/settings/')) return 'settings'
  if (filePath.includes('/leads/')) return 'lawyer'
  if (filePath.includes('/app/app/')) return 'lawyer'
  return 'common'
}

function relKey(entry) {
  return entry.key.startsWith(`${entry.ns}.`)
    ? entry.key.slice(entry.ns.length + 1)
    : entry.key
}

function tVar(ns, preferredNs) {
  if (ns === preferredNs) return 't'
  return `t${ns.charAt(0).toUpperCase()}${ns.slice(1)}`
}

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

function isClientComponent(content) {
  return /^\s*["']use client["']/.test(content)
}

function addImportsAndHooks(content, namespaces, preferredNs) {
  let out = content
  if (!isClientComponent(out)) return out

  if (!out.includes('useTranslations')) {
    const lines = out.split('\n')
    const useClientIdx = lines.findIndex((l) => /["']use client["']/.test(l))
    const insertAt = useClientIdx >= 0 ? useClientIdx + 1 : 0
    lines.splice(insertAt, 0, 'import { useTranslations } from "next-intl"')
    out = lines.join('\n')
  }

  const fnMatch = out.match(/function\s+(\w+)\s*[({][^)]*\)\s*\{/)
  if (!fnMatch) return out
  const insertIdx = fnMatch.index + fnMatch[0].length

  const hooks = []
  for (const ns of namespaces) {
    const v = tVar(ns, preferredNs)
    if (!out.includes(`const ${v} = useTranslations`)) {
      hooks.push(`  const ${v} = useTranslations("${ns}")`)
    }
  }
  if (hooks.length === 0) return out
  return out.slice(0, insertIdx) + '\n' + hooks.join('\n') + out.slice(insertIdx)
}

function migrateFile(filePath, lookup) {
  const original = fs.readFileSync(filePath, 'utf8')
  if (!isClientComponent(original)) return 0
  if (filePath.includes('.test.')) return 0
  // Skip context/lib files — type annotations get corrupted
  if (filePath.includes('/lib/contexts/') || filePath.includes('/lib/api/')) return 0

  const preferredNs = suggestNs(filePath)
  const usedNs = new Set()
  let replacements = 0

  const replaceText = (text) => {
    const trimmed = text.trim()
    if (/^promise$|^record$|^void$|^apiFetch$/i.test(trimmed)) return null
    const entry = lookup.get(trimmed)
    if (!entry) return null
    usedNs.add(entry.ns)
    replacements++
    const v = tVar(entry.ns, preferredNs)
    return `{${v}("${relKey(entry)}")}`
  }

  let content = original

  content = content.replace(/>([^<{][^<>{}\n]{2,120})</g, (match, text) => {
    const rep = replaceText(text)
    return rep ? `>${rep}<` : match
  })

  content = content.replace(/\bplaceholder="([^"]{2,120})"/g, (match, text) => {
    const rep = replaceText(text)
    return rep ? `placeholder={${rep.slice(1, -1)}}` : match
  })

  content = content.replace(/\btitle="([^"]{2,120})"/g, (match, text) => {
    const rep = replaceText(text)
    return rep ? `title={${rep.slice(1, -1)}}` : match
  })

  if (replacements === 0 || content === original) return 0

  content = addImportsAndHooks(content, usedNs, preferredNs)
  fs.writeFileSync(filePath, content)
  return replacements
}

const lookup = buildLookup()
const files = []
walkTsx(WEB_DIR, files)

let total = 0
let fileCount = 0
for (const file of files) {
  const n = migrateFile(file, lookup)
  if (n > 0) {
    total += n
    fileCount++
    console.log(`[migrate-web] ${path.relative(ROOT, file)}: ${n}`)
  }
}
console.log(`[migrate-web] Done: ${total} replacements in ${fileCount} files`)
