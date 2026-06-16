#!/usr/bin/env node
/**
 * Fix Flutter i18n migration errors: camelCase keys, const+l10n, missing l10n vars.
 */
const fs = require('fs')
const path = require('path')
const { toDartKey } = require('./arb-keys')

const ROOT = path.join(__dirname, '../../..')
const APP_LIB = path.join(ROOT, 'legal_app/lib')
const ARB_PATH = path.join(APP_LIB, 'l10n/app_en.arb')

const arb = JSON.parse(fs.readFileSync(ARB_PATH, 'utf8'))
const validKeys = new Set(Object.keys(arb).filter((k) => !k.startsWith('@@')))

const KEY_ALIASES = {
  marketing_welcomeHeadline: 'marketingWelcomeHeadline',
  marketing_welcomeSubhead: 'marketingWelcomeSubhead',
  'common_start_yyyy-mm-dd_hhmm': 'commonStartYyyymmddHhmm',
  'common_end_yyyy-mm-dd_hhmm': 'commonEndYyyymmddHhmm',
}

function walkDart(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.')) walkDart(full, out)
    else if (
      entry.isFile() &&
      entry.name.endsWith('.dart') &&
      !entry.name.includes('app_localizations')
    ) {
      out.push(full)
    }
  }
}

function resolveKey(raw) {
  if (KEY_ALIASES[raw]) return KEY_ALIASES[raw]
  if (validKeys.has(raw)) return raw
  const camel = toDartKey(raw)
  if (validKeys.has(camel)) return camel
  return raw
}

function fixL10nKeys(content) {
  return content.replace(/l10n\.([a-zA-Z][a-zA-Z0-9_-]*)/g, (match, key) => {
    const resolved = resolveKey(key)
    return resolved !== key ? `l10n.${resolved}` : match
  })
}

function stripConstWithL10n(content) {
  let out = content
  out = out.replace(/const InputDecoration\(/g, 'InputDecoration(')
  out = out.replace(/const Text\(l10n\./g, 'Text(l10n.')
  out = out.replace(/const SnackBar\(\s*content:\s*Text\(l10n\./g, 'SnackBar(content: Text(l10n.')
  out = out.replace(/const Center\(\s*child:\s*Text\(l10n\./g, 'Center(child: Text(l10n.')
  return out
}

function ensureImport(content, filePath) {
  if (content.includes('app_localizations.dart')) return content
  const rel = path.relative(path.dirname(filePath), path.join(APP_LIB, 'l10n'))
  const importLine = `import '${rel.split(path.sep).join('/')}/app_localizations.dart';\n`
  const m = content.match(/^import 'package:flutter\/material\.dart';/m)
  if (m) {
    const idx = m.index + m[0].length
    return content.slice(0, idx) + `\n${importLine}` + content.slice(idx)
  }
  return importLine + content
}

function addL10nToBuildMethods(content) {
  const patterns = [
    /Widget build\(BuildContext context, WidgetRef ref\)\s*\{/g,
    /Widget build\(BuildContext context\)\s*\{/g,
  ]
  let out = content
  for (const pattern of patterns) {
    out = out.replace(pattern, (match) => {
      const after = out.indexOf(match)
      const bodyStart = after + match.length
      const nextChunk = out.slice(bodyStart, bodyStart + 120)
      if (nextChunk.includes('final l10n = AppLocalizations')) return match
      return match + '\n    final l10n = AppLocalizations.of(context)!;\n'
    })
  }
  return out
}

function addL10nToStateMethods(content) {
  // Methods in State classes that use l10n but don't define it
  return content.replace(
    /^(\s{2}(?:Future<void>|void|Widget)\s+_\w+[^{]*\{)(\n)/gm,
    (match, head, nl) => {
      const methodStart = content.indexOf(match)
      const nextBrace = content.indexOf('}', methodStart)
      const methodBody = content.slice(methodStart, nextBrace)
      if (!methodBody.includes('l10n.')) return match
      if (methodBody.includes('final l10n = AppLocalizations')) return match
      if (methodBody.includes('AppLocalizations.of(context)')) return match
      return `${head}\n    final l10n = AppLocalizations.of(context)!;${nl}`
    },
  )
}

function addL10nToPrivateWidgetBuild(content) {
  return content.replace(
    /Widget _\w+\([^)]*\)\s*\{/g,
    (match) => {
      const idx = content.indexOf(match)
      const end = content.indexOf('\n  }', idx)
      const body = content.slice(idx, end > 0 ? end : idx + 500)
      if (!body.includes('l10n.')) return match
      if (body.includes('final l10n = AppLocalizations')) return match
      return match + '\n    final l10n = AppLocalizations.of(context)!;\n'
    },
  )
}

function fixFile(filePath) {
  if (!fs.readFileSync(filePath, 'utf8').includes('l10n.')) return false
  let content = fs.readFileSync(filePath, 'utf8')
  const before = content

  content = ensureImport(content, filePath)
  content = fixL10nKeys(content)
  content = stripConstWithL10n(content)
  content = addL10nToBuildMethods(content)
  content = addL10nToStateMethods(content)
  content = addL10nToPrivateWidgetBuild(content)

  if (content !== before) {
    fs.writeFileSync(filePath, content)
    return true
  }
  return false
}

const files = []
walkDart(path.join(APP_LIB, 'features'), files)
walkDart(path.join(APP_LIB, 'widgets'), files)
if (fs.existsSync(path.join(APP_LIB, 'app.dart'))) files.push(path.join(APP_LIB, 'app.dart'))

let fixed = 0
for (const file of files) {
  if (fixFile(file)) {
    fixed++
    console.log(`[fix-flutter-errors] ${path.relative(ROOT, file)}`)
  }
}
console.log(`[fix-flutter-errors] Updated ${fixed} files`)
