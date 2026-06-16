#!/usr/bin/env node
/**
 * Expand locale-overrides with AI-quality translations for common UI strings.
 * Merges phrase-level translations into locale-overrides/{locale}/*.json
 */
const fs = require('fs')
const path = require('path')
const { NAMESPACES, TARGET_LOCALES } = require('./namespaces')

const EN_DIR = path.join(__dirname, '../en')
const OVERRIDES_DIR = path.join(__dirname, 'locale-overrides')

// Core UI phrases — formal legal register where applicable
const PHRASES = {
  fr: {
    'Save': 'Enregistrer', 'Cancel': 'Annuler', 'Close': 'Fermer', 'Continue': 'Continuer',
    'Back': 'Retour', 'Next': 'Suivant', 'Submit': 'Soumettre', 'Delete': 'Supprimer',
    'Edit': 'Modifier', 'Create': 'Créer', 'Search': 'Rechercher', 'Loading…': 'Chargement…',
    'Settings': 'Paramètres', 'Profile': 'Profil', 'Dashboard': 'Tableau de bord',
    'Clients': 'Clients', 'Matters': 'Dossiers', 'Tasks': 'Tâches', 'Documents': 'Documents',
    'Invoices': 'Factures', 'Reports': 'Rapports', 'Sign out': 'Se déconnecter',
    'Sign in': 'Se connecter', 'Sign up': "S'inscrire", 'Email': 'E-mail', 'Password': 'Mot de passe',
    'Required': 'Obligatoire', 'Optional': 'Facultatif', 'Yes': 'Oui', 'No': 'Non',
    'All': 'Tous', 'None': 'Aucun', 'View all': 'Tout voir', 'Learn more': 'En savoir plus',
    'Something went wrong': "Une erreur s'est produite", 'Retry': 'Réessayer',
    'No results found': 'Aucun résultat', 'Country': 'Pays', 'Language': 'Langue',
  },
  de: {
    'Save': 'Speichern', 'Cancel': 'Abbrechen', 'Close': 'Schließen', 'Continue': 'Weiter',
    'Back': 'Zurück', 'Next': 'Weiter', 'Submit': 'Absenden', 'Delete': 'Löschen',
    'Edit': 'Bearbeiten', 'Create': 'Erstellen', 'Search': 'Suchen', 'Loading…': 'Wird geladen…',
    'Settings': 'Einstellungen', 'Profile': 'Profil', 'Dashboard': 'Dashboard',
    'Clients': 'Mandanten', 'Matters': 'Mandate', 'Tasks': 'Aufgaben', 'Documents': 'Dokumente',
    'Invoices': 'Rechnungen', 'Reports': 'Berichte', 'Sign out': 'Abmelden',
    'Sign in': 'Anmelden', 'Sign up': 'Registrieren', 'Email': 'E-Mail', 'Password': 'Passwort',
    'Required': 'Erforderlich', 'Optional': 'Optional', 'Yes': 'Ja', 'No': 'Nein',
    'All': 'Alle', 'None': 'Keine', 'View all': 'Alle anzeigen', 'Learn more': 'Mehr erfahren',
    'Something went wrong': 'Etwas ist schiefgelaufen', 'Retry': 'Erneut versuchen',
    'No results found': 'Keine Ergebnisse', 'Country': 'Land', 'Language': 'Sprache',
  },
  hi: {
    'Save': 'सहेजें', 'Cancel': 'रद्द करें', 'Close': 'बंद करें', 'Continue': 'जारी रखें',
    'Back': 'वापस', 'Next': 'अगला', 'Submit': 'जमा करें', 'Delete': 'हटाएं',
    'Edit': 'संपादित करें', 'Create': 'बनाएं', 'Search': 'खोजें', 'Loading…': 'लोड हो रहा है…',
    'Settings': 'सेटिंग्स', 'Profile': 'प्रोफ़ाइल', 'Dashboard': 'डैशबोर्ड',
    'Clients': 'ग्राहक', 'Matters': 'मामले', 'Tasks': 'कार्य', 'Documents': 'दस्तावेज़',
    'Invoices': 'चालान', 'Reports': 'रिपोर्ट', 'Sign out': 'साइन आउट',
    'Sign in': 'साइन इन', 'Sign up': 'साइन अप', 'Email': 'ईमेल', 'Password': 'पासवर्ड',
    'Required': 'आवश्यक', 'Optional': 'वैकल्पिक', 'Yes': 'हाँ', 'No': 'नहीं',
    'All': 'सभी', 'None': 'कोई नहीं', 'View all': 'सभी देखें', 'Learn more': 'और जानें',
    'Something went wrong': 'कुछ गलत हो गया', 'Retry': 'पुनः प्रयास करें',
    'No results found': 'कोई परिणाम नहीं', 'Country': 'देश', 'Language': 'भाषा',
  },
}

function deepMerge(base, override) {
  if (!override) return structuredClone(base)
  const out = structuredClone(base)
  for (const [key, value] of Object.entries(override)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && typeof out[key] === 'object' && out[key] !== null) {
      out[key] = deepMerge(out[key], value)
    } else {
      out[key] = value
    }
  }
  return out
}

function translateLeaf(text, locale) {
  const map = PHRASES[locale]
  if (!map) return text
  if (map[text]) return map[text]
  let out = text
  for (const [en, tr] of Object.entries(map)) {
    if (en.length > 4 && out.includes(en)) out = out.split(en).join(tr)
  }
  return out
}

function translateTree(obj, locale) {
  if (typeof obj === 'string') return translateLeaf(obj, locale)
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = translateTree(v, locale)
  }
  return out
}

function collectOverrides(en, locale) {
  const translated = translateTree(en, locale)
  const overrides = {}
  function diff(e, t, path = []) {
    for (const [k, ev] of Object.entries(e)) {
      const tv = t[k]
      if (typeof ev === 'string' && typeof tv === 'string' && ev !== tv) {
        let cur = overrides
        const parts = [...path, k]
        for (let i = 0; i < parts.length - 1; i++) {
          if (!cur[parts[i]]) cur[parts[i]] = {}
          cur = cur[parts[i]]
        }
        cur[parts[parts.length - 1]] = tv
      } else if (ev && typeof ev === 'object' && !Array.isArray(ev)) {
        diff(ev, tv || {}, [...path, k])
      }
    }
  }
  diff(en, translated)
  return overrides
}

for (const locale of ['fr', 'de', 'hi']) {
  const localeDir = path.join(OVERRIDES_DIR, locale)
  fs.mkdirSync(localeDir, { recursive: true })
  for (const ns of NAMESPACES) {
    const enPath = path.join(EN_DIR, `${ns}.json`)
    if (!fs.existsSync(enPath)) continue
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))
    const existing = fs.existsSync(path.join(localeDir, `${ns}.json`))
      ? JSON.parse(fs.readFileSync(path.join(localeDir, `${ns}.json`), 'utf8'))
      : {}
    const generated = collectOverrides(en, locale)
    // Existing hand-authored overrides win over auto-generated phrase substitutions
    const merged = deepMerge(generated, existing)
    if (Object.keys(merged).length > 0) {
      fs.writeFileSync(path.join(localeDir, `${ns}.json`), JSON.stringify(merged, null, 2) + '\n')
    }
  }
  console.log(`[expand-translations] ${locale}`)
}
