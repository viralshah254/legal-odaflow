#!/usr/bin/env node
/**
 * Repair auto-migration: ensure useTranslations hooks live in React components
 * that call t("..."), not in helpers or misidentified identifiers like toast(.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../..')
const WEB_DIR = path.join(ROOT, 'legal_web')

const HOOK_RE = /^\s*const (t\w*) = useTranslations\("([^"]+)"\)\s*$/
const T_CALL_RE = /\b(t(?:[A-Z][a-z]*)?)\("/g
const BOGUS_HOOK_VARS = new Set(['toast', 'toggleDoc', 'toggle', 'token', 'table', 'tab', 'tag', 'task', 'tenant', 'time', 'title', 'type'])

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
  if (filePath.includes('/components/ui/')) return 'common'
  if (filePath.includes('/app/app/')) return 'lawyer'
  return 'common'
}

function findBraceBlock(content, openBraceIdx) {
  let depth = 0
  for (let i = openBraceIdx; i < content.length; i++) {
    if (content[i] === '{') depth++
    else if (content[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function findFunctionBlocks(content) {
  const blocks = []
  const re = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g
  let m
  while ((m = re.exec(content)) !== null) {
    const openParen = content.indexOf('(', m.index)
    let i = openParen
    let parenDepth = 0
    for (; i < content.length; i++) {
      if (content[i] === '(') parenDepth++
      else if (content[i] === ')') {
        parenDepth--
        if (parenDepth === 0) break
      }
    }
    const openBrace = content.indexOf('{', i)
    if (openBrace < 0) continue
    const closeBrace = findBraceBlock(content, openBrace)
    if (closeBrace < 0) continue
    blocks.push({
      name: m[1],
      bodyStart: openBrace + 1,
      bodyEnd: closeBrace,
      body: content.slice(openBrace + 1, closeBrace),
      isExported: m[0].startsWith('export'),
    })
  }
  return blocks
}

function usesTranslationCalls(body) {
  T_CALL_RE.lastIndex = 0
  return T_CALL_RE.test(body)
}

function hooksInBody(body) {
  const hooks = new Map()
  for (const line of body.split('\n')) {
    const hm = line.match(HOOK_RE)
    if (hm) hooks.set(hm[1], hm[2])
  }
  return hooks
}

function usedTranslationVars(body) {
  const vars = new Set()
  T_CALL_RE.lastIndex = 0
  let m
  while ((m = T_CALL_RE.exec(body)) !== null) vars.add(m[1])
  return vars
}

function isComponentBody(body) {
  return body.includes('return') && (body.includes('<') || body.includes('jsx'))
}

function fixSheet(content) {
  if (!content.includes('{t("close")}')) return content
  const closeLabel = `
function SheetCloseLabel() {
  const t = useTranslations("common")
  return <span className="sr-only">{t("close")}</span>
}
`
  content = content.replace(
    /<span className="sr-only">\{t\("close"\)\}<\/span>/,
    '<SheetCloseLabel />',
  )
  if (!content.includes('function SheetCloseLabel')) {
    const insertAt = content.indexOf('const Sheet =')
    content = content.slice(0, insertAt) + closeLabel + '\n' + content.slice(insertAt)
  }
  return content
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  if (!content.includes('t(') && !content.includes('useTranslations')) return false
  let changed = false

  if (filePath.endsWith('sheet.tsx')) {
    const next = fixSheet(content)
    if (next !== content) {
      content = next
      changed = true
    }
  }

  const lines = content.split('\n')
  const cleaned = lines.filter((line) => {
    const hm = line.match(HOOK_RE)
    if (hm && BOGUS_HOOK_VARS.has(hm[1])) {
      changed = true
      return false
    }
    return true
  })
  content = cleaned.join('\n')

  const preferredNs = suggestNs(filePath)
  let blocks = findFunctionBlocks(content)

  for (let pass = 0; pass < 3; pass++) {
    blocks = findFunctionBlocks(content)
    let passChanged = false

    for (const block of blocks) {
      if (!usesTranslationCalls(block.body)) continue

      const existing = hooksInBody(block.body)
      const used = usedTranslationVars(block.body)
      const isComponent = isComponentBody(block.body)

      if (!isComponent) {
        if (existing.size > 0) {
          const newBody = block.body
            .split('\n')
            .filter((line) => !HOOK_RE.test(line))
            .join('\n')
          content = content.slice(0, block.bodyStart) + newBody + content.slice(block.bodyEnd)
          passChanged = true
        }
        continue
      }

      const missing = [...used].filter((v) => !existing.has(v))
      if (missing.length === 0) continue

      const hooks = missing.map((v) => `  const ${v} = useTranslations("${preferredNs}")`).join('\n')
      const newBody = '\n' + hooks + block.body
      content = content.slice(0, block.bodyStart) + newBody + content.slice(block.bodyEnd)
      passChanged = true
    }

    if (!passChanged) break
    changed = true
  }

  if (!content.includes('import { useTranslations }') && content.includes('useTranslations(')) {
    const useClientIdx = content.indexOf('"use client"')
    if (useClientIdx >= 0) {
      const lineEnd = content.indexOf('\n', useClientIdx)
      content = content.slice(0, lineEnd + 1) + 'import { useTranslations } from "next-intl"\n' + content.slice(lineEnd + 1)
      changed = true
    }
  }

  if (changed) fs.writeFileSync(filePath, content)
  return changed
}

const files = []
walkTsx(WEB_DIR, files)
let fixed = 0
for (const file of files) {
  if (fixFile(file)) {
    fixed++
    console.log(`[fix-hooks] ${path.relative(ROOT, file)}`)
  }
}
console.log(`[fix-hooks] Repaired ${fixed} files`)
