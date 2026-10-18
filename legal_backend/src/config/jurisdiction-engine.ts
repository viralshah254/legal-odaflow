import {
  DeepJurisdictionProfile,
  JurisdictionProfile,
  LegalSystem,
} from './jurisdictions/types';
import { US_PROFILE } from './jurisdictions/us';
import { IN_PROFILE } from './jurisdictions/in';
import { KE_PROFILE } from './jurisdictions/ke';
import { GB_PROFILE } from './jurisdictions/gb';

export * from './jurisdictions/types';
export * from './jurisdictions/in-overlays';

/** Hand-authored "deep" jurisdictions with 1000x-quality legal context. */
const DEEP_PROFILES: Record<string, DeepJurisdictionProfile> = {
  US: US_PROFILE,
  IN: IN_PROFILE,
  KE: KE_PROFILE,
  GB: GB_PROFILE,
};

export const DEEP_JURISDICTION_CODES = Object.keys(DEEP_PROFILES);

/**
 * Best-effort legal-system classification for non-deep countries. Lets prompts
 * adapt their framing (precedent vs codified) even where we lack a deep profile.
 */
const LEGAL_SYSTEM_BY_COUNTRY: Record<string, LegalSystem> = {
  // Common law
  AU: 'common_law', CA: 'common_law', NZ: 'common_law', IE: 'common_law',
  SG: 'common_law', MY: 'mixed', NG: 'common_law', GH: 'common_law',
  ZA: 'mixed', UG: 'common_law', TZ: 'common_law', ZM: 'common_law',
  ZW: 'mixed', PK: 'mixed', BD: 'common_law', LK: 'mixed', HK: 'common_law',
  // Civil law
  FR: 'civil_law', DE: 'civil_law', IT: 'civil_law', ES: 'civil_law',
  NL: 'civil_law', BE: 'civil_law', PT: 'civil_law', BR: 'civil_law',
  AR: 'civil_law', MX: 'civil_law', CL: 'civil_law', CO: 'civil_law',
  JP: 'civil_law', KR: 'civil_law', CN: 'civil_law', RU: 'civil_law',
  CH: 'civil_law', AT: 'civil_law', SE: 'civil_law', NO: 'civil_law',
  DK: 'civil_law', FI: 'civil_law', PL: 'civil_law', GR: 'civil_law',
  TR: 'civil_law', ID: 'civil_law', TH: 'civil_law', VN: 'civil_law',
  PH: 'mixed',
  // Religious / mixed
  SA: 'religious', AE: 'mixed', QA: 'mixed', EG: 'mixed', PS: 'religious',
  IR: 'religious', MA: 'mixed', JO: 'mixed',
};

const COUNTRY_NAMES: Record<string, string> = {
  AU: 'Australia', CA: 'Canada', NZ: 'New Zealand', IE: 'Ireland',
  SG: 'Singapore', MY: 'Malaysia', NG: 'Nigeria', GH: 'Ghana',
  ZA: 'South Africa', UG: 'Uganda', TZ: 'Tanzania', ZM: 'Zambia',
  ZW: 'Zimbabwe', PK: 'Pakistan', BD: 'Bangladesh', LK: 'Sri Lanka',
  HK: 'Hong Kong', FR: 'France', DE: 'Germany', IT: 'Italy', ES: 'Spain',
  NL: 'Netherlands', BE: 'Belgium', PT: 'Portugal', BR: 'Brazil',
  AR: 'Argentina', MX: 'Mexico', CL: 'Chile', CO: 'Colombia', JP: 'Japan',
  KR: 'South Korea', CN: 'China', RU: 'Russia', CH: 'Switzerland',
  AT: 'Austria', SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland',
  PL: 'Poland', GR: 'Greece', TR: 'Turkey', ID: 'Indonesia', TH: 'Thailand',
  VN: 'Vietnam', PH: 'Philippines', SA: 'Saudi Arabia', AE: 'United Arab Emirates',
  QA: 'Qatar', EG: 'Egypt', IR: 'Iran', MA: 'Morocco', JO: 'Jordan',
};

const LEGAL_SYSTEM_GUIDANCE: Record<LegalSystem, string> = {
  common_law:
    'Common-law system: binding judicial precedent (stare decisis) matters alongside statutes. Cite leading cases and the courts that decided them.',
  civil_law:
    'Civil-law system: codified statutes are primary; case law is persuasive, not strictly binding. Anchor analysis in the relevant code articles.',
  religious:
    'System with significant religious-law influence: account for both codified law and applicable religious legal principles; flag where personal-status rules differ.',
  customary:
    'System with significant customary-law influence: account for recognised customary norms alongside statute.',
  mixed:
    'Mixed legal system: combines codified statute with binding precedent and/or customary/religious elements. Weigh both statutory text and leading case law.',
};

function titleCaseCode(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}

/** Generic profile for any country without a hand-authored deep module. */
function buildBestEffortProfile(code: string): DeepJurisdictionProfile {
  const upper = code.toUpperCase();
  const legalSystem = LEGAL_SYSTEM_BY_COUNTRY[upper] ?? 'mixed';
  return {
    code: upper,
    name: titleCaseCode(upper),
    legalSystem,
    languageOfRecord: ['the official language(s) of the jurisdiction'],
    citationStyle: [
      'Use the official citation format of the jurisdiction; if unknown, cite the court, parties, year, and any report/neutral number you can verify.',
    ],
    courtHierarchy: [
      { name: 'Apex/supreme court of the jurisdiction', role: 'apex' },
      { name: 'Appellate court(s)', role: 'appellate' },
      { name: 'Trial/first-instance court(s)', role: 'trial' },
      { name: 'Specialised tribunals where applicable', role: 'tribunal' },
    ],
    practiceAreas: [
      { name: 'Civil & contract', keyStatutes: ['the jurisdiction\u2019s civil code or contract statutes'] },
      { name: 'Criminal', keyStatutes: ['the jurisdiction\u2019s penal/criminal code'] },
      { name: 'Employment & labour', keyStatutes: ['the jurisdiction\u2019s labour/employment statutes'] },
      { name: 'Family', keyStatutes: ['the jurisdiction\u2019s family/personal-status law'] },
      { name: 'Property & land', keyStatutes: ['the jurisdiction\u2019s property/land statutes'] },
    ],
    adrPathways: [
      { mechanism: 'negotiation', isLegallyBinding: false },
      { mechanism: 'mediation', isLegallyBinding: false },
      { mechanism: 'arbitration', isLegallyBinding: true, note: 'Binding where the jurisdiction recognises arbitral awards (most do via the New York Convention).' },
    ],
    limitationNotes:
      'Limitation/prescription periods vary by claim; confirm the governing statute for this jurisdiction before relying on any deadline.',
    primaryLegislationStyle:
      'Cite the jurisdiction\u2019s official gazette/code and verifiable court reports; never invent citations.',
  };
}

export function formatLegalLocation(
  countryCode: string,
  jurisdiction?: string | null,
): string {
  const profile = DEEP_PROFILES[countryCode?.toUpperCase()];
  const name = profile?.name ?? titleCaseCode(countryCode?.toUpperCase() ?? '');
  if (jurisdiction?.trim()) {
    return `${jurisdiction.trim()}, ${name}`;
  }
  return name;
}

/**
 * Resolve a jurisdiction profile for ANY country code. Deep countries get the
 * hand-authored profile; everything else gets a best-effort profile. Never
 * throws, so global matters always work.
 */
export function resolveJurisdiction(
  countryCode?: string | null,
  jurisdiction?: string | null,
): JurisdictionProfile {
  const upper = (countryCode ?? 'US').toUpperCase();
  const deep = DEEP_PROFILES[upper];
  const base = deep ?? buildBestEffortProfile(upper);
  return {
    ...base,
    tier: deep ? 'deep' : 'best_effort',
    jurisdiction: jurisdiction?.trim() || undefined,
    legalLocation: formatLegalLocation(upper, jurisdiction),
  };
}

/**
 * Render a jurisdiction context block for injection into AI prompts. Gives the
 * model the legal system, citation style, court hierarchy, ADR pathways and
 * limitation guidance so answers are jurisdiction-accurate anywhere.
 */
export function buildJurisdictionPromptBlock(
  profile: JurisdictionProfile,
  options?: { includePracticeAreas?: boolean },
): string {
  const lines: string[] = [
    `Legal location: ${profile.legalLocation}`,
    `Apply the laws and procedures of ${profile.legalLocation} only.`,
    `Legal system: ${LEGAL_SYSTEM_GUIDANCE[profile.legalSystem]}`,
    `Language of record: ${profile.languageOfRecord.join(', ')}.`,
    '',
    'Citation style (follow exactly for this jurisdiction):',
    ...profile.citationStyle.map((c) => `- ${c}`),
    '',
    'Court hierarchy (highest to lowest):',
    ...profile.courtHierarchy.map((c) => `- ${c.name} (${c.role})`),
    '',
    'Dispute-resolution pathways (state binding status correctly):',
    ...profile.adrPathways.map(
      (a) =>
        `- ${a.mechanism}: ${a.isLegallyBinding ? 'legally binding' : 'not legally binding'}${a.note ? ` — ${a.note}` : ''}`,
    ),
    '',
    `Limitation/prescription: ${profile.limitationNotes}`,
    `Primary sources: ${profile.primaryLegislationStyle}`,
  ];

  if (options?.includePracticeAreas) {
    lines.push(
      '',
      'Relevant practice areas and governing statutes:',
      ...profile.practiceAreas.map(
        (p) => `- ${p.name}: ${p.keyStatutes.join('; ')}`,
      ),
    );
  }

  if (profile.tier === 'best_effort') {
    lines.push(
      '',
      'NOTE: This jurisdiction is handled on a best-effort basis. Be explicit about uncertainty, prefer verifiable primary sources, and recommend confirmation with a locally licensed practitioner where the law is unclear.',
    );
  }

  return lines.join('\n');
}
