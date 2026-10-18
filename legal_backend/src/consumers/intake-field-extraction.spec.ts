import {
  CONTRACT_INTAKE_FIELD_IDS,
  extractFieldsHeuristicFromFacts,
  filterQuestionsByExtractedFields,
  mergeExtractedIntoAnswers,
  normalizeExtractedFields,
  type PlanQuestionItem,
} from './intake-field-extraction';

const CONTRACTOR_PROMPT =
  'help me draft a contract for glen ayienda a contractor for 3 months earning 100k inr per month, we are a us company paying him. company is partice co, address is 40 kau road, atlanta, georgia, us. the job description is back end and dev ops engineering, tasks are to build product infra';

describe('intake-field-extraction', () => {
  describe('normalizeExtractedFields', () => {
    it('trims strings and drops empty values', () => {
      expect(
        normalizeExtractedFields({
          party1Name: '  Partice Co  ',
          party2Name: '',
          party2Address: null,
          specialClauses: [' IP ownership ', ''],
        }),
      ).toEqual({
        party1Name: 'Partice Co',
        specialClauses: ['IP ownership'],
      });
    });
  });

  describe('extractFieldsHeuristicFromFacts', () => {
    it('extracts contractor prompt fields', () => {
      const extracted = extractFieldsHeuristicFromFacts(CONTRACTOR_PROMPT);

      expect(extracted.party1Name).toMatch(/partice co/i);
      expect(extracted.party2Name).toMatch(/glen ayienda/i);
      expect(extracted.party1Address).toMatch(/40 kau road/i);
      expect(extracted.paymentTerms).toBeTruthy();
      expect(extracted.contractDuration).toMatch(/3 months/i);
      expect(extracted.scopeOfWork).toBeTruthy();
      expect(extracted.party2Role).toBe('contractor');
    });
  });

  describe('filterQuestionsByExtractedFields', () => {
    const baseQuestions: PlanQuestionItem[] = [
      {
        id: 'party1Name',
        text: "Please provide the full legal name of Party 1 (the client / instructing party).",
        required: true,
        type: 'text',
        options: [],
      },
      {
        id: 'party1Address',
        text: 'Please provide the full legal address of Party 1 (the client / instructing party).',
        required: true,
        type: 'text',
        options: [],
      },
      {
        id: 'party2Name',
        text: 'Please provide the full legal name of Party 2 (the counterparty / contractor).',
        required: true,
        type: 'text',
        options: [],
      },
      {
        id: 'party2Address',
        text: 'Please provide the full legal address of Party 2 (the counterparty / contractor).',
        required: true,
        type: 'text',
        options: [],
      },
      {
        id: 'governingLaw',
        text: 'Which governing law should apply to this agreement?',
        required: false,
        type: 'single',
        options: ['US law', 'Indian law', 'Other'],
      },
    ];

    it('drops party name/address questions when already extracted', () => {
      const extracted = extractFieldsHeuristicFromFacts(CONTRACTOR_PROMPT);
      const filtered = filterQuestionsByExtractedFields(baseQuestions, extracted);

      expect(filtered.map((q) => q.id)).not.toContain('party1Name');
      expect(filtered.map((q) => q.id)).not.toContain('party1Address');
      expect(filtered.map((q) => q.id)).not.toContain('party2Name');
      expect(filtered.map((q) => q.id)).toContain('party2Address');
      expect(filtered.map((q) => q.id)).toContain('governingLaw');
    });

    it('drops questions by text pattern when id differs', () => {
      const extracted = { party1Name: 'Partice Co' };
      const filtered = filterQuestionsByExtractedFields(
        [
          {
            id: 'q1',
            text: 'What is Party 1 full legal name?',
            required: true,
            type: 'text',
            options: [],
          },
        ],
        extracted,
      );
      expect(filtered).toHaveLength(0);
    });
  });

  describe('mergeExtractedIntoAnswers', () => {
    it('merges extracted fields and lets user answers override', () => {
      const merged = mergeExtractedIntoAnswers(
        { party1Name: 'Partice Co', paymentTerms: '100k INR/month' },
        { party1Name: 'Partice Co LLC', governingLaw: 'Georgia, US' },
      );

      expect(merged.party1Name).toBe('Partice Co LLC');
      expect(merged.paymentTerms).toBe('100k INR/month');
      expect(merged.governingLaw).toBe('Georgia, US');
    });
  });

  it('exports contract field registry', () => {
    expect(CONTRACT_INTAKE_FIELD_IDS).toContain('party1Name');
    expect(CONTRACT_INTAKE_FIELD_IDS).toContain('governingLaw');
  });
});
