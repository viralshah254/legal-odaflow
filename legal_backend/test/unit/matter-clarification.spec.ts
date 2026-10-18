import {
  extractMatterFacts,
  hasMaintenanceLanguage,
  isFamilyDisputeContext,
} from '@/ai/draft-intent/matter-fact-extractor';
import {
  MatterClarificationService,
  filterGenericMiQuestions,
  mergeClarifyingQuestions,
} from '@/ai/draft-intent/matter-clarification.service';
import {
  hasActionableClarifyingAnswers,
  resolveKindFromAnswers,
} from '@/ai/draft-intent/draft-intent.helpers';
import type { MatterProfile } from '@/ai/matter-intelligence/matter-intelligence.types';

export const RAM_VS_RIA_QUERY = `
Ram vs ria
Ria filed for dowry, harassment, mental distress by ram and his parents
They got married in 2025 jan
Shortly after a month ria filed a dv case
Interim order was issued to ram to pay 100000 per month
Ram challenges- no marriage happened as per hindu rituals
Ria is educated also, she-is sitting idle
No dowry demand ever happened
`.trim();

describe('matter-fact-extractor — Ram vs Ria', () => {
  it('extracts parties and interim maintenance context without the word maintenance', () => {
    const facts = extractMatterFacts(RAM_VS_RIA_QUERY);
    expect(facts.parties.label?.toLowerCase()).toContain('ram');
    expect(facts.hasDvCase).toBe(true);
    expect(facts.hasInterimOrder).toBe(true);
    expect(facts.hasMaintenanceContext).toBe(true);
    expect(facts.orderAmount).toBe('100000');
    expect(facts.hasMarriageValidityChallenge).toBe(true);
    expect(facts.hasDowryDenial).toBe(true);
    expect(facts.posture).toBe('challenge');
  });

  it('detects maintenance language from interim monthly payment', () => {
    expect(hasMaintenanceLanguage('Interim order to pay 100000 per month')).toBe(true);
  });
});

describe('MatterClarificationService — contextual questions', () => {
  const service = new MatterClarificationService();

  const familyProfile: MatterProfile = {
    country: 'IN',
    practiceArea: 'family_matrimonial',
    subPracticeArea: 'maintenance',
    nature: 'dispute',
    posture: 'revision',
    remedies: [],
    issues: ['Maintenance claim', 'Interim vs final order'],
    documentTypes: [],
    curatedKinds: [],
    confidence: 0.71,
    fieldConfidence: {
      practiceArea: 0.85,
      subPracticeArea: 0.75,
      nature: 0.72,
      forum: 0.5,
    },
  };

  it('returns fact-aware relief_sought instead of generic nature question', () => {
    const extracted = extractMatterFacts(RAM_VS_RIA_QUERY);
    const questions = service.buildContextualQuestions(RAM_VS_RIA_QUERY, familyProfile, {
      documentIntent: 'challenge',
      orderType: 'interim',
      statuteConfidence: 'medium',
    }, extracted);

    expect(questions.length).toBeGreaterThan(0);
    expect(questions.some((q) => q.id === 'relief_sought')).toBe(true);
    expect(questions.some((q) => q.prompt.includes('disputing/challenging'))).toBe(false);

    const relief = questions.find((q) => q.id === 'relief_sought')!;
    expect(relief.options.some((o) => o.value === 'challenge_interim_maintenance')).toBe(true);
    expect(relief.options.some((o) => o.value === 'deny_marriage_validity')).toBe(true);
    expect(relief.options.some((o) => o.value === 'defend_dv_merits')).toBe(true);
  });

  it('filters generic MI nature question when family domain is known', () => {
    const extracted = extractMatterFacts(RAM_VS_RIA_QUERY);
    const filtered = filterGenericMiQuestions(
      [
        {
          id: 'nature',
          field: 'nature',
          text: 'Are you disputing/challenging something, or drafting a new document?',
          options: ['Disputing / challenging (litigation)'],
        },
      ],
      familyProfile,
      extracted,
      { documentIntent: 'challenge' },
    );
    expect(filtered.some((q) => q.id === 'nature')).toBe(false);
  });

  it('merges contextual questions ahead of generic MI questions', () => {
    const extracted = extractMatterFacts(RAM_VS_RIA_QUERY);
    const contextual = service.buildContextualQuestions(
      RAM_VS_RIA_QUERY,
      familyProfile,
      { documentIntent: 'challenge', statuteConfidence: 'medium' },
      extracted,
    );
    const merged = mergeClarifyingQuestions(contextual, [], [
      {
        id: 'nature',
        field: 'nature',
        text: 'Generic nature question',
        options: ['Disputing / challenging (litigation)'],
      },
    ]);
    expect(merged[0]?.id).toBe('relief_sought');
    expect(merged.some((q) => q.id === 'nature')).toBe(false);
  });

  it('asks for document kind when analyzed kind confidence is low', () => {
    const questions = service.buildContextualQuestions(
      'Buyer paid for defective goods and may need either consumer complaint or demand letter',
      {
        country: 'IN',
        practiceArea: 'consumer',
        nature: 'dispute',
        remedies: [],
        issues: [],
        documentTypes: [],
        curatedKinds: [],
        confidence: 0.62,
      },
      {
        documentKind: 'consumer_complaint',
        documentKindConfidence: 'low',
        documentKindAlternatives: ['demand_letter'],
        documentKindReason: 'The facts describe a consumer dispute about defective goods.',
      },
    );

    const documentKindQuestion = questions.find((q) => q.id === 'document_kind');
    expect(documentKindQuestion).toBeDefined();
    expect(documentKindQuestion?.options.some((o) => o.value === 'consumer_complaint')).toBe(true);
    expect(documentKindQuestion?.options.some((o) => o.value === 'demand_letter')).toBe(true);
  });
});

describe('resolveKindFromAnswers — Ram vs Ria routing', () => {
  it('routes relief_sought answers to maintenance revision or written statement', () => {
    expect(
      resolveKindFromAnswers({
        relief_sought: 'challenge_interim_maintenance',
        maintenance_statute: 'dv_act',
      }),
    ).toBe('maintenance_order_revision');

    expect(
      resolveKindFromAnswers({
        relief_sought: 'defend_dv_merits',
      }),
    ).toBe('written_statement_dv');
  });

  it('treats actionable answers as sufficient to proceed', () => {
    expect(
      hasActionableClarifyingAnswers({
        relief_sought: 'challenge_interim_maintenance',
      }),
    ).toBe(true);
    expect(hasActionableClarifyingAnswers({ nature: 'Disputing / challenging (litigation)' })).toBe(
      false,
    );
    expect(hasActionableClarifyingAnswers({ document_kind: 'police_complaint' })).toBe(true);
  });
});

describe('isFamilyDisputeContext', () => {
  it('recognises DV + interim order as family dispute', () => {
    const extracted = extractMatterFacts(RAM_VS_RIA_QUERY);
    expect(isFamilyDisputeContext(undefined, extracted)).toBe(true);
  });
});
