#!/usr/bin/env node
/**
 * Scan legal_web and legal_app for hardcoded user-facing strings.
 * Output: shared/i18n/extraction/candidates.json
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../..')
const OUT = path.join(__dirname, '../extraction/candidates.json')

const WEB_PATTERNS = [
  />([^<{][^<>{}\n]{2,80})<\//g,
  /placeholder=["']([^"']{2,80})["']/g,
  /title=["']([^"']{2,80})["']/g,
  /label=["']([^"']{2,80})["']/g,
  /CardTitle[^>]*>([^<]{2,80})</g,
  /DialogTitle[^>]*>([^<]{2,80})</g,
]

const DART_PATTERNS = [
  /Text\s*\(\s*['"]([^'"]{2,80})['"]/g,
  /hintText:\s*['"]([^'"]{2,80})['"]/g,
  /labelText:\s*['"]([^'"]{2,80})['"]/g,
  /title:\s*(?:const\s+)?Text\s*\(\s*['"]([^'"]{2,80})['"]/g,
  /subtitle:\s*(?:const\s+)?Text\s*\(\s*['"]([^'"]{2,80})['"]/g,
  /label:\s*['"]([^'"]{2,80})['"]/g,
]

function walkDir(dir, ext, out) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.includes('node_modules') && !entry.name.startsWith('.')) {
      walkDir(full, ext, out)
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      out.push(full)
    }
  }
}

function suggestNamespace(filePath) {
  if (filePath.includes('/auth/')) return 'auth'
  if (filePath.includes('/dashboard/')) return 'dashboard'
  if (filePath.includes('/matters/')) return 'matters'
  if (filePath.includes('/clients/')) return 'clients'
  if (filePath.includes('/billing/') || filePath.includes('/finance/') || filePath.includes('/accounting/')) return 'billing'
  if (filePath.includes('/copilot/')) return 'copilot'
  if (filePath.includes('/issue-checker/') || filePath.includes('issue_checker')) return 'issueChecker'
  if (filePath.includes('/consumer/')) return 'consumer'
  if (filePath.includes('/admin/')) return 'admin'
  if (filePath.includes('/portal/')) return 'portal'
  if (filePath.includes('/settings/')) return 'settings'
  if (filePath.includes('/marketing/') || filePath.includes('app/page.tsx')) return 'marketing'
  if (filePath.includes('/legal-guides/')) return 'legalGuides'
  if (filePath.includes('/components/ui/')) return 'common'
  if (filePath.includes('/app/app/')) return 'lawyer'
  return 'common'
}

function extractFromFile(filePath, patterns) {
  const content = fs.readFileSync(filePath, 'utf8')
  const found = new Set()
  for (const pattern of patterns) {
    const re = new RegExp(pattern.source, pattern.flags)
    let m
    while ((m = re.exec(content)) !== null) {
      const text = m[1].trim()
      if (text && !text.startsWith('{') && !text.includes('${') && !/^[a-z]+-[a-z-]+$/.test(text)) {
        found.add(text)
      }
    }
  }
  return [...found]
}

const webFiles = []
walkDir(path.join(ROOT, 'legal_web'), '.tsx', webFiles)
const dartFiles = []
walkDir(path.join(ROOT, 'legal_app/lib'), '.dart', dartFiles)

const byNamespace = {}
const byFile = {}

for (const file of webFiles) {
  if (file.includes('node_modules') || file.includes('.test.')) continue
  const strings = extractFromFile(file, WEB_PATTERNS)
  if (strings.length === 0) continue
  const rel = path.relative(ROOT, file)
  byFile[rel] = strings
  const ns = suggestNamespace(file)
  if (!byNamespace[ns]) byNamespace[ns] = new Set()
  strings.forEach((s) => byNamespace[ns].add(s))
}

for (const file of dartFiles) {
  if (file.includes('.g.dart') || file.includes('app_localizations')) continue
  const strings = extractFromFile(file, DART_PATTERNS)
  if (strings.length === 0) continue
  const rel = path.relative(ROOT, file)
  byFile[rel] = [...(byFile[rel] || []), ...strings]
  const ns = suggestNamespace(file)
  if (!byNamespace[ns]) byNamespace[ns] = new Set()
  strings.forEach((s) => byNamespace[ns].add(s))
}

const summary = {
  generatedAt: new Date().toISOString(),
  totalFiles: Object.keys(byFile).length,
  totalStrings: Object.values(byFile).reduce((a, b) => a + b.length, 0),
  byNamespace: Object.fromEntries(
    Object.entries(byNamespace).map(([k, v]) => [k, [...v].sort()]),
  ),
  byFile,
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(summary, null, 2) + '\n')
console.log(`[i18n:extract] ${summary.totalStrings} strings in ${summary.totalFiles} files`)
console.log(`[i18n:extract] → ${path.relative(ROOT, OUT)}`)
