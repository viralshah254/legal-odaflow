/**
 * Generates task-pattern matrix entries from platform taxonomy.
 * Run: npm run generate:task-pattern-matrix
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  PROFESSIONAL_DOMAINS,
  TIER1_JURISDICTIONS,
  featuresForJurisdiction,
  type PlatformDomain,
  type TaskPatternFeature,
  type Tier1Jurisdiction,
} from '../src/config/taxonomy/platform-taxonomy';

const JURISDICTION_LABEL: Record<Tier1Jurisdiction, string> = {
  IN: 'India',
  US: 'United States',
  KE: 'Kenya',
  GB: 'United Kingdom',
};

const FEATURE_LABEL: Record<TaskPatternFeature, string> = {
  research: 'Research',
  draft: 'Draft',
  review: 'Review',
  intake: 'Intake',
  copilot: 'Copilot',
  law_library: 'Law Library',
  section_finder: 'Section Finder',
};

function draftKindFor(domain: PlatformDomain, jurisdiction: Tier1Jurisdiction): string {
  if (jurisdiction === 'IN') {
    const map: Record<string, string> = {
      litigation_disputes: 'india_civil_suit_money_recovery',
      pleadings_notices: 'india_civil_plaint',
      consumer: 'india_consumer_complaint',
      arbitration_adr: 'india_arbitration_notice_s21',
      corporate_commercial: 'india_service_agreement_india',
      banking_finance: 'india_drt_oa',
      insolvency: 'india_nclt_cirp_real_estate',
      tax: 'india_gst_registration_application',
      intellectual_property: 'india_trademark_opposition',
      employment_labour: 'india_industrial_disputes_reference',
      family_matrimonial: 'india_divorce_petition_s13',
      real_estate_property: 'india_sale_deed',
      regulatory_compliance: 'india_rti_application',
      startups: 'india_llp_incorporation',
      white_collar: 'india_fir_complaint',
      wills_estates_probate: 'india_probate_petition',
      immigration: 'india_form_catalog',
      general_usage: 'india_form_catalog',
    };
    return map[domain.slug] ?? 'india_form_catalog';
  }
  return 'us_form_catalog';
}

function buildPrefill(
  domain: PlatformDomain,
  feature: TaskPatternFeature,
  jurisdiction: Tier1Jurisdiction,
) {
  const countryCode = jurisdiction;
  const label = domain.label;
  switch (feature) {
    case 'research':
      return {
        countryCode,
        query: `Research ${label.toLowerCase()} issues under ${JURISDICTION_LABEL[jurisdiction]} law — key statutes, leading cases, and procedural requirements.`,
      };
    case 'draft':
      return {
        kind: draftKindFor(domain, jurisdiction),
        label: `${label} — draft`,
        countryCode,
        details: `Draft a ${label.toLowerCase()} document for a client matter in ${JURISDICTION_LABEL[jurisdiction]}. Include relevant facts placeholders and statutory references.`,
      };
    case 'review':
      return {
        countryCode,
        documentType: 'GENERAL',
        focusAreas: domain.subdomains.slice(0, 3).map((s) => s.label),
      };
    case 'intake':
      return {
        countryCode,
        brief: `New client intake for a ${label.toLowerCase()} matter in ${JURISDICTION_LABEL[jurisdiction]}. Summarize client goals, parties, urgency, and documents available.`,
      };
    case 'law_library':
      return {
        countryCode,
        query: `${label} — browse applicable statutes in ${JURISDICTION_LABEL[jurisdiction]}`,
      };
    case 'section_finder':
      return {
        countryCode,
        query: `${domain.subdomains[0]?.label ?? label} — find applicable section`,
      };
    case 'copilot':
      return {
        countryCode,
        query: `Help counsel with a ${label.toLowerCase()} matter: summarize issues, suggest next steps, and flag risks under ${JURISDICTION_LABEL[jurisdiction]} law.`,
      };
    default:
      return { countryCode };
  }
}

interface MatrixPattern {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  targetFeature: TaskPatternFeature;
  jurisdiction: Tier1Jurisdiction;
  domainSlug: string;
  practiceAreas: string[];
  tags: string[];
  prefill: Record<string, unknown>;
  scope: 'system';
  sortOrder: number;
}

const patterns: MatrixPattern[] = [];
let sortOrder = 1000;

for (const domain of PROFESSIONAL_DOMAINS) {
  for (const jurisdiction of TIER1_JURISDICTIONS) {
    if (!domain.jurisdictions.includes(jurisdiction)) continue;
    for (const feature of featuresForJurisdiction(jurisdiction, domain.features)) {
      const id = `${jurisdiction.toLowerCase()}-${feature}-${domain.slug}`.replace(/_/g, '-');
      const title = `${FEATURE_LABEL[feature]} — ${domain.label}`;
      const description = `${FEATURE_LABEL[feature]} starter for ${domain.label} (${JURISDICTION_LABEL[jurisdiction]}).`;
      patterns.push({
        id,
        slug: id,
        title,
        description,
        body: description,
        targetFeature: feature,
        jurisdiction,
        domainSlug: domain.slug,
        practiceAreas: [domain.slug, ...domain.aliases.slice(0, 2)],
        tags: [domain.slug, feature, jurisdiction.toLowerCase()],
        prefill: buildPrefill(domain, feature, jurisdiction),
        scope: 'system',
        sortOrder: sortOrder++,
      });
    }
  }
}

const outPath = path.join(__dirname, '../src/task-patterns/task-patterns.matrix.generated.ts');
const content = `/** Auto-generated by scripts/generate-task-pattern-matrix.ts — do not edit manually. */
import type { LegalTaskPattern } from './task-patterns.types';

export const MATRIX_TASK_PATTERNS: LegalTaskPattern[] = ${JSON.stringify(patterns, null, 2)} as LegalTaskPattern[];
`;

fs.writeFileSync(outPath, content);
console.log(`Generated ${patterns.length} matrix patterns → ${outPath}`);
