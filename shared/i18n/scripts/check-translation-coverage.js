#!/usr/bin/env node
/**
 * Report % of keys identical to English per locale/namespace.
 * Exit non-zero when --strict and any locale exceeds threshold.
 */
const fs = require('fs')
const path = require('path')
const { NAMESPACES, TARGET_LOCALES } = require('./namespaces')

const SHARED_I18N = path.join(__dirname, '..')
const OUT = path.join(SHARED_I18N, 'extraction/translation-coverage.json')

/** Exact values that legitimately stay in English across locales (brands, codes, loanwords). */
const ALLOWLIST_EXACT = new Set([
  'Umbrella', 'DVTech Ventures', 'Adobe Sign', 'DocuSign', 'WhatsApp',
  'USD', 'GBP', 'EUR', 'KES', 'INR',
  'OPEN', 'PAID', 'CLOSED', 'NEW', 'DONE', 'ACTIVE',
  'PARTNER_ADMIN', 'ASSOCIATE', 'PARALEGAL', 'FINANCE', 'SOLO',
  'AI', 'KYC', 'DOCX', 'HTML', 'PDF', 'OTP', 'SMS', 'API', 'URL', 'FCM', 'TXT',
  'Auto', 'Client', 'Client *', 'Client:', 'Client 360',
  'Code', 'Code:', 'Contact', 'Contacts', 'Date', 'Date *',
  'Description', 'Description *', 'Document', 'Documents',
  'Finance', 'Immigration', 'Kenya', 'Message', 'Messages',
  'Notifications', 'Plus', 'Pro', 'Question', 'Situation', 'Solo',
  'Source', 'Total', 'Urgent', 'Webhooks', 'Kanban', 'Pipeline',
  'Action', 'Action:', 'Actions (JSON)', 'Citation', 'Citations',
  'Classification', 'Conditions (JSON)', 'Diligence', 'Doc',
  'Assistance', 'Organisation', 'Instructions', 'Shared With',
  'Minutes:', 'Note:', 'Co.', 'P&L', 'Profit',
  'Jane Doe', '+254712345678', '+1 555 123 4567', 'client@email.com',
  'email@example.com', 'you@example.com', 'you@lawfirm.com', 'contact@example.com', 'signer@example.com',
  '••••••••', '700 000 000', 'POST /webhooks/test', 'GET /public-api/keys', 'X-Legal-Signature',
  'Version:', '⌘ Actions',
  'Documents ({count})', 'Page {page}',
  '$caseItem.issueType · $countryName', '$priceLabel · $packLabel',
  '$dayNum', '$overallPct%', '$title\\n$body', '$unreadCount',
  'Top up AI credits',
  'Optional', 'Name:', 'Name', 'Name *', 'Status', 'Status *', 'Status: {status}',
  'Professional', 'Ref', 'Filter', 'Medium', '(optional)', 'Portal', 'Team', 'Team:',
  'Legal', 'Live', 'Start', 'Admin', 'Credits', 'Referrer', 'Export', 'Upgrade', 'System',
  'Rate', 'Due Diligence', 'Engagement', 'CNR:', 'E-Sign', 'Ind.',
  'KYC & Compliance', 'Acme Corporation', 'Agent Command Center',
  'Matter Kickoff Agent', 'Partner (Admin)', 'Ops/HR', 'Don',
  '150.00', '0.00', 'SSO URL', 'userId1, userId2',
  'Status:', '45–65%', 'View Finance:', 'View Team:', 'assignee',
  'matterId1, matterId2', '2-in-1',
  '10K+', 'ChatGPT', 'LegalZoom', 'Clio', 'vs {name}',
])

const ALLOWLIST_PATTERNS = [
  /^[A-Z]{2,5}$/,
  /^\+[\d\s\-()]+$/,
  /^[\d\s+\-\(\)\.]+$/,
  /^[\w.+-]+@[\w.-]+\.\w+$/,
  /^(GET|POST|PUT|DELETE|PATCH)\s+\//,
  /^X-[A-Za-z-]+(:|$)/,
  /^\$[\w.]+(\s*[·•]\s*\$[\w.]+)?$/,
  /^v\d+(\.\d+)?$/i,
]

function isAllowlisted(value) {
  if (ALLOWLIST_EXACT.has(value)) return true
  if (/^\{count,\s*plural,/.test(value)) return true
  if (/^\{[\w.]+\s*,\s*plural,/.test(value)) return true
  return ALLOWLIST_PATTERNS.some((re) => re.test(value))
}

function flat(obj, prefix, ns, out) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${ns}.${prefix}.${k}` : `${ns}.${k}`
    if (typeof v === 'string') out[key] = v
    else if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, prefix ? `${prefix}.${k}` : k, ns, out)
  }
}

function loadLocale(locale) {
  const map = {}
  for (const ns of NAMESPACES) {
    const p = path.join(SHARED_I18N, locale, `${ns}.json`)
    if (!fs.existsSync(p)) continue
    flat(JSON.parse(fs.readFileSync(p, 'utf8')), '', ns, map)
  }
  return map
}

function run() {
  const enMap = loadLocale('en')
  const report = { generatedAt: new Date().toISOString(), locales: {}, summary: {} }

  for (const locale of TARGET_LOCALES) {
    const locMap = loadLocale(locale)
    let identical = 0
    let allowlisted = 0
    let total = 0
    const byNs = {}

    for (const [key, enVal] of Object.entries(enMap)) {
      if (!locMap[key]) continue
      total++
      const ns = key.split('.')[0]
      if (!byNs[ns]) byNs[ns] = { total: 0, identical: 0 }
      byNs[ns].total++
      if (locMap[key] === enVal) {
        if (isAllowlisted(enVal)) {
          allowlisted++
        } else {
          identical++
          byNs[ns].identical++
        }
      }
    }

    const pct = total ? Math.round((identical / total) * 100) : 0
    report.locales[locale] = {
      total,
      untranslated: identical,
      allowlisted,
      pctUntranslated: pct,
      byNamespace: Object.fromEntries(
        Object.entries(byNs).map(([ns, v]) => [ns, { ...v, pct: v.total ? Math.round((v.identical / v.total) * 100) : 0 }]),
      ),
    }
    report.summary[locale] = `${pct}% untranslated (${identical}/${total})`
    console.log(`[i18n:coverage] ${locale}: ${pct}% untranslated (${identical}/${total})`)
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n')
  console.log(`[i18n:coverage] → ${path.relative(path.join(SHARED_I18N, '..'), OUT)}`)

  const strict = process.argv.includes('--strict')
  const maxPct = parseInt(process.argv.find((a) => a.startsWith('--max-pct='))?.split('=')[1] || '0', 10)
  if (strict) {
    const bad = Object.entries(report.locales).filter(([, v]) => v.pctUntranslated > maxPct || v.untranslated > 0 && maxPct === 0)
    if (bad.length) {
      console.error(`[i18n:coverage] FAILED: ${bad.map(([l, v]) => `${l}=${v.untranslated} untranslated`).join(', ')}`)
      process.exit(1)
    }
    console.log('[i18n:coverage] OK — all locales within threshold')
  }
}

if (require.main === module) run()

module.exports = { isAllowlisted, ALLOWLIST_EXACT }
