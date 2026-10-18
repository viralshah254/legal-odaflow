import {
  DraftIntentAnalyzeService,
  shouldOfferFamilyLawClarifyingQuestions,
} from '@/ai/draft-intent/draft-intent-analyze.service';
import { MatterClarificationService } from '@/ai/draft-intent/matter-clarification.service';
import {
  resolveCuratedDraftLabel,
  resolveExplicitDocumentKindFromQuery,
  shouldSkipClarifyingQuestions,
} from '@/ai/draft-intent/draft-intent.helpers';
import { ARJUN_WRONGFUL_TERMINATION_FACTS } from '@/ai/matter-intelligence/__tests__/golden-fixtures';

const NEHA_CRIMINAL_REVISION_QUERY = `
Mrs. Neha Sharma married Mr. Rohit Sharma on 15 February 2021 according to Hindu rites. After one year of marriage, disputes arose.
Neha filed a petition seeking interim maintenance before the Family Court under the applicable matrimonial law.
The Family Court dismissed Neha's application.
Assignment: Draft a Criminal Revision Petition challenging the order rejecting interim maintenance
`.trim();

describe('shouldOfferFamilyLawClarifyingQuestions', () => {
  const maintenanceRevisionQuery =
    'Mrs. Neha Sharma married Mr. Rohit Sharma on 15 February 2024. Draft revision against interim maintenance order before Family Court Ahmedabad.';

  it('blocks family-law questions when MI classified employment_labour', () => {
    expect(
      shouldOfferFamilyLawClarifyingQuestions('employment_labour', ARJUN_WRONGFUL_TERMINATION_FACTS),
    ).toBe(false);
  });

  it('blocks family-law questions for employment even when text mentions maintenance incidentally', () => {
    const mixed =
      'Wrongful termination without inquiry. Workman seeks reinstatement. Also reference maintenance order revision from another matter.';
    expect(shouldOfferFamilyLawClarifyingQuestions('employment_labour', mixed)).toBe(false);
  });

  it('allows family-law questions for family_matrimonial practice area', () => {
    expect(
      shouldOfferFamilyLawClarifyingQuestions('family_matrimonial', maintenanceRevisionQuery),
    ).toBe(true);
  });

  it('allows family-law questions for unclassified text with explicit maintenance language', () => {
    expect(shouldOfferFamilyLawClarifyingQuestions(undefined, maintenanceRevisionQuery)).toBe(true);
  });

  it('does not offer family-law questions for revision-only text without maintenance keywords', () => {
    expect(
      shouldOfferFamilyLawClarifyingQuestions(
        'litigation_disputes',
        'File revision petition against labour court termination order',
      ),
    ).toBe(false);
  });
});

describe('explicit document intent — Criminal Revision Petition', () => {
  it('resolves Neha maintenance challenge to maintenance_order_revision', () => {
    expect(resolveExplicitDocumentKindFromQuery(NEHA_CRIMINAL_REVISION_QUERY)).toBe(
      'maintenance_order_revision',
    );
  });

  it('skips clarifying questions when user names Criminal Revision Petition', () => {
    expect(shouldSkipClarifyingQuestions(NEHA_CRIMINAL_REVISION_QUERY)).toBe(true);
  });

  it('labels the curated match Criminal Revision Petition when user asked for it', () => {
    const { label } = resolveCuratedDraftLabel(
      'maintenance_order_revision',
      'india_maintenance_order_revision',
      NEHA_CRIMINAL_REVISION_QUERY,
    );
    expect(label).toBe('Criminal Revision Petition');
  });
});

describe('DraftIntentAnalyzeService — LLM document kind extraction', () => {
  it('preserves mocked LLM documentKind in analysis context', async () => {
    const llm = {
      complete: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          jurisdiction: null,
          statute: null,
          court: null,
          orderType: null,
          documentIntent: 'apply',
          documentKind: 'consumer_complaint',
          documentKindConfidence: 'high',
          documentKindAlternatives: ['demand_letter'],
          documentKindReason: 'Defective goods and refund compensation indicate consumer forum relief.',
        }),
      }),
    };
    const matterPipeline = {
      run: jest.fn().mockResolvedValue({
        profile: {
          country: 'IN',
          practiceArea: 'consumer',
          nature: 'dispute',
          remedies: [],
          issues: [],
          documentTypes: [],
          curatedKinds: [],
          confidence: 0.52,
        },
        clarifyingQuestions: [],
        shouldProceed: true,
        recommendationMode: 'low_confidence',
      }),
    };

    const service = new DraftIntentAnalyzeService(
      llm as never,
      matterPipeline as never,
      new MatterClarificationService(),
    );

    const result = await service.analyze(
      'Buyer received defective refrigerator, seller refuses refund and compensation.',
    );

    expect(result.context.documentKind).toBe('consumer_complaint');
    expect(result.context.documentKindConfidence).toBe('high');
    expect(result.context.documentKindAlternatives).toEqual(['demand_letter']);
  });
});
