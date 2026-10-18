import { LegalEvidencePackService } from './legal-evidence-pack.service';
import { evaluateLegalQuality } from './legal-quality-gates';
import type { LegalResearchDraft } from './legal-research-draft.types';

describe('legal quality gates', () => {
  const packService = new LegalEvidencePackService();

  function baseDraft(overrides: Partial<LegalResearchDraft> = {}): LegalResearchDraft {
    return {
      directAnswer: { text: 'The claim is moderately likely, subject to proof.', confidence: 0.7 },
      issues: [
        {
          issueId: 'cruelty',
          heading: 'Matrimonial cruelty',
          conclusion: {
            text: 'The cumulative conduct may amount to cruelty on the civil standard.',
            confidence: 0.7,
            strength: 'MODERATE',
            controllingReasons: ['The alleged course of conduct and its impact require assessment.'],
            factualDependencies: ['Contemporaneous complaint records and later cohabitation.'],
            adverseConsiderations: ['A good-faith complaint may remain unproved without being false.'],
          },
          propositions: [],
        },
      ],
      practicalSteps: [
        {
          id: 'step_preserve_records',
          action: 'Preserve complaint orders and communications.',
          timing: 'Immediately',
          purpose: 'Test chronology, good faith, and cumulative effect.',
          evidenceNeeded: ['Certified orders', 'messages'],
          safeActionType: 'PRESERVE_EVIDENCE',
        },
      ],
      limitations: [],
      unansweredQuestions: [
        {
          id: 'question_post_incident_cohabitation',
          question: 'Did the spouses resume cohabitation after the alleged cruelty?',
          whyItMatters: 'It may engage condonation and revival under HMA s.23.',
          expectedAnswerType: 'YES_NO',
          affectedIssueId: 'cruelty',
          suggestedSource: 'Addresses, travel records, and communications',
        },
      ],
      ...overrides,
    };
  }

  it('passes a complete calibrated contract', () => {
    const pack = packService.buildFromAuthorities({ jurisdiction: 'IN', authorities: [] });
    expect(evaluateLegalQuality(baseDraft(), pack)).toEqual([]);
  });

  it('flags absolute outcomes, generic questions, placeholder cases, and unsafe steps', () => {
    const pack = packService.buildFromAuthorities({ jurisdiction: 'IN', authorities: [] });
    const draft = baseDraft({
      directAnswer: { text: 'You will definitely win.', confidence: 1 },
      issues: [
        {
          issueId: 'i1',
          heading: 'Outcome',
          conclusion: 'The court will grant divorce.',
          propositions: [
            {
              claimId: 'r1',
              text: 'The leading case [CASE NAME] decides the issue.',
              type: 'RULE',
              evidenceIds: [],
              confidence: 0.8,
            },
          ],
        },
      ],
      unansweredQuestions: ['Any other facts?'],
      practicalSteps: ['File an FIR immediately.'],
    });

    const ids = evaluateLegalQuality(draft, pack).map((item) => item.checkId);
    expect(ids).toEqual(
      expect.arrayContaining([
        'quality:absolute_outcome',
        'quality:placeholder_case:r1',
        'quality:generic_unanswered_question',
        'quality:unconditional_legacy_step',
      ]),
    );
  });

  it('requires a pinpoint and adverse analysis for material case propositions', () => {
    const pack = packService.buildFromAuthorities({
      jurisdiction: 'IN',
      authorities: [
        {
          id: 'case_without_pinpoint',
          title: 'A v B',
          citation: '2024 INSC 1',
          sourceTier: 'case_law',
          fullText: 'The court considered matrimonial cruelty.',
        },
      ],
    });
    const evidenceId = pack.authorities[0].passages[0].evidenceId;
    const draft = baseDraft({
      issues: [
        {
          issueId: 'cruelty',
          heading: 'Cruelty',
          conclusion: 'Cruelty is likely.',
          propositions: [
            {
              claimId: 'holding_1',
              text: 'The court considered matrimonial cruelty.',
              type: 'HOLDING',
              evidenceIds: [evidenceId],
              confidence: 0.8,
              materiality: 'MATERIAL',
            },
          ],
        },
      ],
      risksAndDefences: [],
    });

    const ids = evaluateLegalQuality(draft, pack).map((item) => item.checkId);
    expect(ids).toContain('quality:missing_pinpoint:holding_1');
    expect(ids).toContain('quality:missing_adverse_analysis:cruelty');
  });
});
