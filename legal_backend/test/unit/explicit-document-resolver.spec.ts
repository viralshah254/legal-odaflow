import {
  extractExplicitDocumentPhrases,
  resolveExplicitDocumentBundle,
} from '@/ai/draft-intent/explicit-document-requests';
import { resolveExplicitDocumentsWithoutLlm } from '@/ai/draft-intent/explicit-document-resolver.service';

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

const ANANYA_RAO_PREPARE = `
Drafting Request
Prepare:
1. A legal research memorandum;
2. An employment claim or civil proceeding in the appropriate forum;
3. A legal notice;
4. An interim application seeking preservation of employment records and restraint against misuse of confidential allegations;
5. A case strategy identifying supporting and adverse authorities.
`.trim();

const employmentProfile = {
  practiceArea: 'employment_labour',
  subPracticeArea: 'wrongful_termination',
  nature: 'dispute' as const,
  forum: 'labour_court',
  curatedKinds: ['india_wrongful_termination'],
};

describe('explicit document resolver', () => {
  it('maps medical-negligence Prepare list to four kinds via regex tier', async () => {
    const result = await resolveExplicitDocumentsWithoutLlm({
      query: MEDICAL_NEGLIGENCE_PREPARE,
    });
    expect(result.hasExplicitSection).toBe(true);
    expect(result.resolutions).toHaveLength(4);
    expect(result.resolutions.every((r) => r.source === 'regex')).toBe(true);
    expect(result.unmapped).toHaveLength(0);
    expect(result.bundle.map((b) => b.kind)).toEqual([
      'india_legal_research_memo',
      'india_consumer_complaint',
      'india_interim_application_document_production',
      'india_case_strategy_memo',
    ]);
  });

  it('maps Ananya Rao Prepare list to five kinds with employment claim via catalog', async () => {
    const result = await resolveExplicitDocumentsWithoutLlm({
      query: ANANYA_RAO_PREPARE,
      matterProfile: employmentProfile,
    });
    expect(result.resolutions).toHaveLength(5);
    expect(result.unmapped).toHaveLength(0);
    expect(result.bundle.map((b) => b.kind)).toEqual([
      'india_legal_research_memo',
      'india_wrongful_termination',
      'india_legal_notice',
      'india_interim_application_document_production',
      'india_case_strategy_memo',
    ]);
    const employmentResolution = result.resolutions.find((r) =>
      /employment claim/i.test(r.phrase),
    );
    expect(employmentResolution?.source).toBe('catalog');
    expect(employmentResolution?.provisional).toBe(true);
  });

  it('returns a bundle of one for single-item Prepare list', async () => {
    const query = `
Drafting Request
Prepare:
1. A consumer complaint seeking compensation
`.trim();
    const legacy = resolveExplicitDocumentBundle(query);
    expect(legacy).toBeUndefined();

    const result = await resolveExplicitDocumentsWithoutLlm({ query });
    expect(result.bundle).toHaveLength(1);
    expect(result.bundle[0]?.kind).toBe('india_consumer_complaint');
  });

  it('surfaces unknown phrases in unmapped with suggestions', async () => {
    const query = `
Drafting Request
Prepare:
1. A quantum meruit fee statement for architectural services;
2. A legal notice;
`.trim();
    const result = await resolveExplicitDocumentsWithoutLlm({ query });
    expect(result.resolutions.some((r) => r.kind === 'india_legal_notice')).toBe(true);
    expect(result.unmapped.length).toBeGreaterThanOrEqual(1);
    expect(result.unmapped[0]?.phrase.toLowerCase()).toContain('quantum meruit');
    expect(result.unmapped[0]?.suggestions.length).toBeGreaterThan(0);
  });

  it('extracts phrases from Drafting Request numbered list', () => {
    const phrases = extractExplicitDocumentPhrases(MEDICAL_NEGLIGENCE_PREPARE);
    expect(phrases.length).toBeGreaterThanOrEqual(4);
  });
});
