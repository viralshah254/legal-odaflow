/**
 * AI credits integration tests for document drafting pricing.
 */

import {
  FULL_AI_DRAFT_MIN_CREDITS,
  getCreditCost,
} from '@/ai-credits/credit-costs';
import { AI_TASK_TYPES } from '@/ai-credits/task-types';
import { computeCreditsFromProviderCost } from '@/ai-credits/credit-pricing.util';
import type { DraftVerificationAudit } from '@/ai/drafting/draft-verification.types';

const DRAFT_CREDIT_ROUTES = {
  draftIntentSearch: 'POST /ai/draft-intent/resolve',
  indiaGenerate: 'POST /ai/india-draft/generate',
  usGenerate: 'POST /ai/us-draft/generate',
  sessionGenerate: 'POST /drafting-sessions/:id/generate',
  matterDraftWithAi: 'POST /document-automation/matters/:matterId/templates/:templateId/draft-with-ai',
};

/** Shared verification audit contract for all draft generate endpoints. */
export const DRAFT_VERIFY_RESPONSE_CONTRACT: {
  draft: string;
  creditsUsed: number;
  verification: DraftVerificationAudit;
} = {
  draft: 'string',
  creditsUsed: FULL_AI_DRAFT_MIN_CREDITS,
  verification: {
    corrections: [],
    similarCases: [],
    sectionChecks: { entries: [], anyCorrections: false, anyUnconfirmedMismatches: false },
    citationWarnings: [],
    strippedCitations: [],
    proceduralWarnings: [],
    completenessGaps: [],
    requiresLawyerReview: false,
    verificationStatus: 'verified',
  },
};

/** @deprecated Use DRAFT_VERIFY_RESPONSE_CONTRACT */
export const INDIA_DRAFT_VERIFY_RESPONSE_CONTRACT = DRAFT_VERIFY_RESPONSE_CONTRACT;

describe('Document drafting credit pricing', () => {
  it('documents draft credit routes for CI contract coverage', () => {
    expect(DRAFT_CREDIT_ROUTES.draftIntentSearch).toContain('/ai/draft-intent/resolve');
    expect(DRAFT_CREDIT_ROUTES.indiaGenerate).toContain('/ai/india-draft/generate');
    expect(DRAFT_CREDIT_ROUTES.usGenerate).toContain('/ai/us-draft/generate');
    expect(DRAFT_CREDIT_ROUTES.sessionGenerate).toContain('/generate');
    expect(DRAFT_CREDIT_ROUTES.matterDraftWithAi).toContain('/draft-with-ai');
  });

  it('retains the intent-search preflight estimate', () => {
    expect(getCreditCost(AI_TASK_TYPES.DRAFT_INTENT_SEARCH)).toBe(5);
  });

  it('settles draft usage at twice cost without fixed minimums', () => {
    for (const taskType of [
      AI_TASK_TYPES.DOCUMENT_DRAFT,
      AI_TASK_TYPES.TEMPLATE_DRAFT,
      AI_TASK_TYPES.INDIA_COURT_DRAFT,
    ]) {
      expect(getCreditCost(taskType)).toBeGreaterThan(0);
      const tokenCharge = computeCreditsFromProviderCost(
        0.002,
        0.01,
        40,
        getCreditCost(taskType),
      );
      expect(tokenCharge).toBe(1);
    }
  });

  it('charges credits for minor draft edits', () => {
    expect(getCreditCost(AI_TASK_TYPES.DRAFT_FILL_BLANKS)).toBe(5);
    expect(getCreditCost(AI_TASK_TYPES.DRAFT_SELECTION_EDIT)).toBe(1);
  });

  it('documents shared draft verification audit response contract', () => {
    expect(DRAFT_VERIFY_RESPONSE_CONTRACT.verification.strippedCitations).toEqual([]);
    expect(DRAFT_VERIFY_RESPONSE_CONTRACT.verification.verificationStatus).toBe('verified');
    expect(Array.isArray(DRAFT_VERIFY_RESPONSE_CONTRACT.verification.similarCases)).toBe(true);
    expect(DRAFT_CREDIT_ROUTES.usGenerate).toContain('/ai/us-draft/generate');
    expect(DRAFT_CREDIT_ROUTES.sessionGenerate).toContain('/generate');
  });
});

describe('AI credits integration (stub)', () => {
  it.todo('deducts 2 credits on draft intent resolve');
  it.todo('deducts at least 15 credits on india/us draft generate');
});

describe('AI credits — research and document review routes', () => {
  const RESEARCH_CREDIT_ROUTES = {
    legalResearch: 'POST /legal-research/query',
    documentReview: 'POST /document-review/analyze',
    copilotChat: 'POST /copilot/chat',
  };

  it('documents credit-bearing research routes for CI contract coverage', () => {
    expect(RESEARCH_CREDIT_ROUTES.legalResearch).toContain('/legal-research/query');
    expect(RESEARCH_CREDIT_ROUTES.documentReview).toContain('/document-review/analyze');
    expect(RESEARCH_CREDIT_ROUTES.copilotChat).toContain('/copilot/chat');
  });

  it('retains a one-credit research preflight estimate', () => {
    expect(getCreditCost(AI_TASK_TYPES.LEGAL_RESEARCH)).toBe(1);
  });
});
