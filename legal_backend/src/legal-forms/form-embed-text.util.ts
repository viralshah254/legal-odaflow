import type { JurisdictionForm } from '@prisma/client';

export const JURISDICTION_FORM_SOURCE_TYPE = 'JURISDICTION_FORM';

const PRACTICE_SYNONYMS: Record<string, string[]> = {
  FAMILY_MATRIMONIAL: [
    'domestic violence',
    'protection order',
    'non-molestation',
    'restraining order',
    'divorce',
    'custody',
    'matrimonial',
    'spouse',
    'husband',
    'wife',
    'partner',
    'harm',
    'assault',
    'family court',
    'complaint',
    'petition',
  ],
  CRIMINAL: [
    'police complaint',
    'fir',
    'criminal complaint',
    'bail',
    'charge sheet',
    'prosecution',
    'accused',
    'victim',
    'stalking',
    'harassment',
    'bns 78',
    'cyberstalking',
    'magistrate complaint',
  ],
  CIVIL_LITIGATION: ['complaint', 'claim', 'petition', 'plaintiff', 'defendant', 'court filing'],
  IMMIGRATION: ['visa', 'asylum', 'sponsor', 'immigration application'],
  CORPORATE: ['company formation', 'incorporation', 'directors', 'shareholders'],
  PROPERTY: ['conveyancing', 'lease', 'land registry', 'title'],
  EMPLOYMENT_LABOUR: [
    'employment',
    'labour',
    'labor',
    'wrongful termination',
    'wrongful dismissal',
    'termination',
    'reinstatement',
    'back wages',
    'workman',
    'industrial dispute',
    'labour court',
    'ID Act',
    'retrenchment',
    'severance',
    'gratuity',
    'employment contract',
    'offer letter',
    'appointment letter',
    'POSH',
    'sexual harassment',
  ],
  CONSUMER: [
    'consumer complaint',
    'consumer forum',
    'consumer protection',
    'deficiency in service',
    'defective product',
    'refund',
    'unfair trade practice',
    'consumer commission',
    'product liability',
    'warranty',
    'seller',
    'purchase invoice',
  ],
  ARBITRATION: [
    'arbitration',
    'arbitral',
    'arbitral award',
    'arbitration clause',
    'section 11',
    'section 34',
    'section 9',
    'emergency arbitrator',
    'statement of claim',
    'arbitral tribunal',
    'seat of arbitration',
    'UNCITRAL',
    'mediation',
  ],
};

function synonymsForForm(form: JurisdictionForm): string[] {
  const base = PRACTICE_SYNONYMS[form.practiceArea] ?? [];
  const name = form.formName.toLowerCase();
  const extra: string[] = [];

  if (/domestic violence|harm|non.?molestation|molestation/i.test(name)) {
    extra.push(
      'domestic violence',
      'protection order',
      'non-molestation',
      'restraining order',
      'abuse',
      'assault',
      'attacked',
      'husband',
      'wife',
      'spouse',
      'family harm',
      'complaint',
      'allegations',
      'petition',
    );
  }
  if (/complaint|petition|application/i.test(name)) {
    extra.push('complaint', 'petition', 'application', 'filing', 'court form');
  }
  if (/bail/i.test(name)) extra.push('bail', 'custody', 'release');
  if (/writ/i.test(name)) extra.push('writ', 'habeas corpus', 'mandamus');
  if (/lease|tenancy|rent/i.test(name)) extra.push('lease', 'tenancy', 'landlord', 'tenant');
  if (/nda|confidential/i.test(name)) extra.push('nda', 'confidentiality', 'non-disclosure');
  if (/service agreement|contract/i.test(name)) extra.push('service agreement', 'contract', 'contractor');

  return [...new Set([...base, ...extra])];
}

/** Text blob embedded for semantic form search. */
export function buildFormEmbedText(form: JurisdictionForm): string {
  const lines = [
    `Form: ${form.formName}${form.formNumber ? ` (${form.formNumber})` : ''}`,
    `Country: ${form.countryCode}${form.jurisdiction ? ` | Jurisdiction: ${form.jurisdiction}` : ''}`,
    `Practice area: ${form.practiceArea}${form.category ? ` | Category: ${form.category}` : ''}`,
    `Authority: ${form.authority}`,
  ];
  if (form.description?.trim()) {
    lines.push(`Description: ${form.description.trim()}`);
  }
  const synonyms = synonymsForForm(form);
  if (synonyms.length > 0) {
    lines.push(`Also known as: ${synonyms.join(', ')}`);
  }
  return lines.join('\n');
}

/** Lexical search target (same fields as scoring). */
export function formSearchText(form: JurisdictionForm): string {
  return [
    form.formName,
    form.formNumber,
    form.authority,
    form.description,
    form.practiceArea,
    form.category,
    synonymsForForm(form).join(' '),
  ]
    .filter(Boolean)
    .join(' ');
}
