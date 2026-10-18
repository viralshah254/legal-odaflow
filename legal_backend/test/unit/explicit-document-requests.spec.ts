import {
  extractExplicitDocumentPhrases,
  mapPhraseToDraftKind,
  resolveExplicitDocumentBundle,
} from '@/ai/draft-intent/explicit-document-requests';
import { resolveDocumentBundle } from '@/ai/draft-intent/draft-intent-bundles';

const MEDICAL_NEGLIGENCE_PREPARE = `
Sample Test Case: Medical Negligence and Consumer Complaint

Jurisdiction
Ahmedabad, Gujarat, India.

Drafting Request

Prepare:

1. A legal research memorandum;
2. A consumer complaint seeking compensation;
3. An interim application for preservation and production of medical records;
4. A case strategy identifying supporting and adverse authorities.

Parties
Complainant: Riya Desai, aged 32 years.
Opposite Party No. 1: Sunrise Multispeciality Hospital Pvt. Ltd.
`.trim();

describe('explicit document requests', () => {
  it('maps medical-negligence Prepare list to four kinds in order', () => {
    const bundle = resolveExplicitDocumentBundle(MEDICAL_NEGLIGENCE_PREPARE);
    expect(bundle).toBeDefined();
    expect(bundle!.map((b) => b.kind)).toEqual([
      'india_legal_research_memo',
      'india_consumer_complaint',
      'india_interim_application_document_production',
      'india_case_strategy_memo',
    ]);
    expect(bundle!.every((b) => b.selectedByDefault)).toBe(true);
    expect(bundle!.map((b) => b.order)).toEqual([1, 2, 3, 4]);
  });

  it('maps property-style prepare list to three existing kinds', () => {
    const query = `
Drafting Request
Prepare:
1. A legal notice
2. A civil plaint
3. An interim injunction application
`.trim();
    const bundle = resolveExplicitDocumentBundle(query);
    expect(bundle?.map((b) => b.kind)).toEqual([
      'india_legal_notice',
      'india_civil_plaint',
      'india_application_temp_injunction',
    ]);
  });

  it('returns undefined for facts-only query with no Prepare list', () => {
    const query = `
Complainant: Riya Desai. Hospital performed gallbladder surgery.
A CT scan was performed on 13 March 2025. She seeks compensation.
`.trim();
    expect(resolveExplicitDocumentBundle(query)).toBeUndefined();
  });

  it('returns undefined for a single named document', () => {
    const query = `
Drafting Request
Prepare:
1. A consumer complaint seeking compensation
`.trim();
    expect(resolveExplicitDocumentBundle(query)).toBeUndefined();
  });

  it('extracts phrases from Drafting Request numbered list', () => {
    const phrases = extractExplicitDocumentPhrases(MEDICAL_NEGLIGENCE_PREPARE);
    expect(phrases.length).toBeGreaterThanOrEqual(4);
    expect(mapPhraseToDraftKind(phrases[0])?.kind).toBe('india_legal_research_memo');
  });

  it('overrides playbook path when explicit list is present (medical facts + prepare)', () => {
    const explicit = resolveExplicitDocumentBundle(MEDICAL_NEGLIGENCE_PREPARE);
    expect(explicit).toBeDefined();
    // Explicit list wins over any playbook the same facts might trigger
    const playbook = resolveDocumentBundle(undefined, MEDICAL_NEGLIGENCE_PREPARE);
    const chosen = explicit ?? playbook;
    expect(chosen?.map((b) => b.kind)).toEqual(explicit!.map((b) => b.kind));
  });
});
