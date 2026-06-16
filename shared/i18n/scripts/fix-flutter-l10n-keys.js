#!/usr/bin/env node
/**
 * Fix broken migrate-flutter-auto.js output:
 * - Wrong import package:legal_app → relative l10n import
 * - snake_case l10n keys → camelCase ARB keys
 * - Add missing l10n var in build methods
 * - Remove const from widgets using l10n
 */
const fs = require('fs')
const path = require('path')
const { toDartKey } = require('./arb-keys')

const ROOT = path.join(__dirname, '../../..')
const APP_LIB = path.join(ROOT, 'legal_app/lib')
const ARB_PATH = path.join(APP_LIB, 'l10n/app_en.arb')

const arb = JSON.parse(fs.readFileSync(ARB_PATH, 'utf8'))
const validKeys = new Set(Object.keys(arb).filter((k) => !k.startsWith('@@')))

function relativeL10nImport(filePath) {
  const rel = path.relative(path.dirname(filePath), path.join(APP_LIB, 'l10n'))
  const normalized = rel.split(path.sep).join('/')
  return `import '${normalized}/app_localizations.dart';`
}

function fixSnakeL10nKeys(content) {
  return content.replace(/l10n\.([a-zA-Z][a-zA-Z0-9_]*)/g, (match, snake) => {
    if (!snake.includes('_')) return match
    const camel = toDartKey(snake)
    if (validKeys.has(camel)) return `l10n.${camel}`
    // marketing_splashForIndividuals → marketingSplashForIndividuals
    const nsSplit = snake.match(/^([a-z]+)_(.+)$/)
    if (nsSplit) {
      const alt = toDartKey(`${nsSplit[1]}_${nsSplit[2]}`)
      if (validKeys.has(alt)) return `l10n.${alt}`
    }
    return match
  })
}

function ensureL10nImport(content, filePath) {
  const importLine = relativeL10nImport(filePath)
  if (content.includes('app_localizations.dart')) {
    return content.replace(
      /import\s+['"]package:legal_app\/l10n\/app_localizations\.dart['"];\n?/g,
      `${importLine}\n`,
    )
  }
  const flutterImport = content.match(/^import 'package:flutter\/material\.dart';/m)
  if (flutterImport) {
    const idx = flutterImport.index + flutterImport[0].length
    return content.slice(0, idx) + `\n${importLine}` + content.slice(idx)
  }
  return `${importLine}\n${content}`
}

function ensureL10nVar(content) {
  if (content.includes('final l10n = AppLocalizations.of(context)!')) return content
  if (content.includes('final l10n = AppLocalizations.of(context);')) {
    return content.replace(
      /final l10n = AppLocalizations\.of\(context\);/g,
      'final l10n = AppLocalizations.of(context)!;',
    )
  }

  const patterns = [
    /Widget build\(BuildContext context, WidgetRef ref\)\s*\{/,
    /Widget build\(BuildContext context\)\s*\{/,
  ]
  for (const pattern of patterns) {
    const m = content.match(pattern)
    if (m) {
      const idx = m.index + m[0].length
      return (
        content.slice(0, idx) +
        '\n    final l10n = AppLocalizations.of(context)!;\n' +
        content.slice(idx)
      )
    }
  }
  return content
}

function stripConstL10n(content) {
  return content
    .replace(/const Text\(l10n\./g, 'Text(l10n.')
    .replace(/const SnackBar\(content: Text\(l10n\./g, 'SnackBar(content: Text(l10n.')
    .replace(/const Center\(child: Text\(l10n\./g, 'Center(child: Text(l10n.')
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

const targets = [
  path.join(APP_LIB, 'features'),
  path.join(APP_LIB, 'widgets'),
  path.join(APP_LIB, 'core/config/app_config.dart'),
  path.join(APP_LIB, 'core/pricing/plan_benefits.dart'),
  path.join(APP_LIB, 'app.dart'),
]

let fixed = 0
for (const target of targets) {
  const files = []
  if (fs.statSync(target).isDirectory()) walkDart(target, files)
  else files.push(target)

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8')
    if (!content.includes('l10n.') && !content.includes('AppLocalizations')) continue

    const before = content
    content = ensureL10nImport(content, file)
    content = fixSnakeL10nKeys(content)
    content = ensureL10nVar(content)
    content = stripConstL10n(content)

    if (content !== before) {
      fs.writeFileSync(file, content)
      fixed++
      console.log(`[fix-flutter-l10n] ${path.relative(ROOT, file)}`)
    }
  }
}
console.log(`[fix-flutter-l10n] Updated ${fixed} files`)
