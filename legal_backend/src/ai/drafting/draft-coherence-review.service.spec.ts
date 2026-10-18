import { DraftCoherenceReviewService } from './draft-coherence-review.service';
import type { LlmCompletionService } from '@/ai/llm-completion.service';

const ORIGINAL = [
  'IN THE COURT OF SESSIONS',
  'Applicant: A. Kumar. Respondent: State.',
  'The applicant was arrested on 04/02/2024 and has been in custody since.',
  'GROUND 1: No recovery was effected. See Sanjay Chandra v. CBI (2012) 1 SCC 40.',
  'GROUND 2: Delay in trial. [AUTHORITY GAP]',
  'PRAYER: Grant bail.',
].join('\n');

describe('DraftCoherenceReviewService', () => {
  const makeService = (llm: Partial<LlmCompletionService>) =>
    new DraftCoherenceReviewService(llm as LlmCompletionService);

  const baseInput = {
    draft: ORIGINAL,
    documentKind: 'bail_application',
    countryCode: 'IN',
    model: 'reviewer',
    allowRevision: true,
  };

  it('reports degraded rather than a clean bill when the model is unavailable', async () => {
    const service = makeService({
      isModelConfigured: jest.fn().mockReturnValue(false),
      complete: jest.fn(),
    });

    const result = await service.review(baseInput);

    expect(result.degraded).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('accepts a revision that only reconciles what was already in the filing', async () => {
    const revised = ORIGINAL.replace('Delay in trial.', 'Delay in trial since 04/02/2024.');
    const service = makeService({
      isModelConfigured: jest.fn().mockReturnValue(true),
      complete: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          issues: [
            {
              severity: 'MEDIUM',
              category: 'chronology',
              explanation: 'Ground 2 did not anchor the delay to the arrest date.',
            },
          ],
          revisedDraft: revised,
        }),
      }),
    });

    const result = await service.review(baseInput);

    expect(result.revisedDraft).toBe(revised);
    expect(result.issues[0].category).toBe('chronology');
  });

  it('rejects a revision that slips in a new citation', async () => {
    const service = makeService({
      isModelConfigured: jest.fn().mockReturnValue(true),
      complete: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          issues: [],
          revisedDraft: `${ORIGINAL}\nGROUND 3: See Arnesh Kumar v. State of Bihar (2014) 8 SCC 273.`,
        }),
      }),
    });

    const result = await service.review(baseInput);

    expect(result.revisedDraft).toBeUndefined();
    expect(result.revisionRejectedReason).toMatch(/new citation/);
  });

  it('rejects a revision that slips in a new date', async () => {
    const service = makeService({
      isModelConfigured: jest.fn().mockReturnValue(true),
      complete: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          issues: [],
          revisedDraft: ORIGINAL.replace('has been in custody since', 'has been in custody since 11/03/2024'),
        }),
      }),
    });

    const result = await service.review(baseInput);

    expect(result.revisionRejectedReason).toMatch(/new date/);
  });

  it('rejects a revision that quietly drops an authority-gap marker', async () => {
    const service = makeService({
      isModelConfigured: jest.fn().mockReturnValue(true),
      complete: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          issues: [],
          revisedDraft: ORIGINAL.replace(' [AUTHORITY GAP]', ''),
        }),
      }),
    });

    const result = await service.review(baseInput);

    expect(result.revisionRejectedReason).toMatch(/authority-gap marker/);
  });

  it('does not ask for a rewrite when revision is not allowed', async () => {
    const complete = jest.fn().mockResolvedValue({
      content: JSON.stringify({ issues: [], revisedDraft: 'something else entirely' }),
    });
    const service = makeService({ isModelConfigured: jest.fn().mockReturnValue(true), complete });

    const result = await service.review({ ...baseInput, allowRevision: false });

    expect(result.revisedDraft).toBeUndefined();
    const system = complete.mock.calls[0][0].messages[0].content as string;
    expect(system).not.toContain('revisedDraft');
  });
});
