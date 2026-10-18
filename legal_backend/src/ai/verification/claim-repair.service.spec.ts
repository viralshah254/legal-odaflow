import { ClaimRepairService } from './claim-repair.service';
import type { ClaimAudit, LegalResearchDraft } from '@/ai/legal-research/legal-research-draft.types';

describe('ClaimRepairService markdown enforcement', () => {
  const service = new ClaimRepairService();
  const claimText = 'The statute always permits recovery without prior notice.';
  const draft: LegalResearchDraft = {
    directAnswer: { text: claimText, confidence: 0.8 },
    issues: [
      {
        issueId: 'notice',
        heading: 'Notice',
        conclusion: 'Unresolved',
        propositions: [
          {
            claimId: 'claim-1',
            text: claimText,
            type: 'RULE',
            evidenceIds: ['E1'],
            confidence: 0.8,
          },
        ],
      },
    ],
    practicalSteps: [],
    limitations: [],
    unansweredQuestions: [],
  };

  const audit: ClaimAudit = {
    claimId: 'claim-1',
    identityVerified: false,
    passageSupport: 'UNSUPPORTED',
    jurisdictionValid: true,
    hierarchyValid: 'INDETERMINATE',
    treatmentValid: 'INDETERMINATE',
    currentLawValid: 'INDETERMINATE',
    confidence: 0,
    action: 'REMOVE',
  };

  it('withholds an unsupported material proposition from markdown', () => {
    const result = service.repairMarkdown(`# Rule\n\n${claimText}`, [audit], draft);
    expect(result).not.toContain(claimText);
    expect(result).toContain('proposition withheld');
  });
});
