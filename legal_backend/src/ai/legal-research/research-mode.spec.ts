import {
  buildFallbackResearchMemo,
  CALM_RESEARCH_FALLBACK_REASON,
  capVerifiedResearchModel,
  compactResearchQueryForPrompt,
  computeResearchCreditsFromCost,
  extractResearchQuestionPresented,
  isFastResearch,
  isGuidanceResearch,
  isResearchStallOrTimeoutError,
  normalizeResearchQuestionPresented,
  researchDeadlineMs,
  researchFallbackReason,
  researchSynthesisTimeoutMs,
  shouldIgnorePremiumOverride,
  VERIFIED_RESEARCH_MODEL,
} from './research-mode';

describe('research-mode', () => {
  it('treats GUIDANCE as a fast path that ignores Premium', () => {
    expect(isGuidanceResearch('GUIDANCE')).toBe(true);
    expect(isFastResearch('GUIDANCE')).toBe(true);
    expect(isFastResearch('FAST')).toBe(true);
    expect(isFastResearch('DEEP')).toBe(false);
    expect(shouldIgnorePremiumOverride('FAST')).toBe(true);
    expect(shouldIgnorePremiumOverride('GUIDANCE')).toBe(true);
    expect(shouldIgnorePremiumOverride('DEEP')).toBe(false);
  });

  it('caps Fast and Verified wall-clock', () => {
    expect(researchDeadlineMs('GUIDANCE')).toBe(15_000);
    expect(researchDeadlineMs('FAST')).toBe(25_000);
    expect(researchDeadlineMs('DEEP')).toBe(60_000);
    expect(researchSynthesisTimeoutMs('FAST')).toBe(12_000);
    expect(researchSynthesisTimeoutMs('DEEP')).toBe(28_000);
    expect(researchSynthesisTimeoutMs('GUIDANCE', 8_000)).toBe(15_000);
    expect(researchSynthesisTimeoutMs('FAST', 8_000)).toBe(25_000);
    expect(researchSynthesisTimeoutMs('DEEP', 8_000)).toBe(28_000);
  });

  it('extracts a short question from a pasted contract dump', () => {
    const query = [
      'My client owes me. What can I do? What are my options?',
      '',
      'SOFTWARE IMPLEMENTATION AND SERVICES AGREEMENT',
      'This Agreement dated 10 March 2026 between Coolcatch and DV Tech.',
      'IN WITNESS WHEREOF the parties have signed.',
    ].join('\n');
    expect(extractResearchQuestionPresented(query)).toContain('My client owes me');
    expect(extractResearchQuestionPresented(query)).toContain('What can I do?');
    expect(normalizeResearchQuestionPresented(query, query)).toContain('My client owes me');
    expect(compactResearchQueryForPrompt(query.repeat(80))).toContain(
      '[… middle omitted for length …]',
    );
    expect(researchFallbackReason('Drafting timed out — returning a guidance note')).toBe(
      CALM_RESEARCH_FALLBACK_REASON,
    );
    expect(
      researchFallbackReason('Research drafting exceeded the mode deadline; returning a first-pass note.'),
    ).toBe(CALM_RESEARCH_FALLBACK_REASON);
    expect(researchFallbackReason('job stalled more than allowable limit')).toBe(
      CALM_RESEARCH_FALLBACK_REASON,
    );
    expect(researchFallbackReason('Missing lock for job')).toBe(CALM_RESEARCH_FALLBACK_REASON);
    const fallback = buildFallbackResearchMemo({
      query,
      countryCode: 'KE',
      researchMode: 'GUIDANCE',
      reason: 'Drafting timed out — returning a guidance note from the retrieved sources.',
    });
    expect(fallback).toContain(CALM_RESEARCH_FALLBACK_REASON);
    expect(fallback).not.toMatch(/timed out|deadline|exceeded/i);
    expect(fallback).not.toContain('**Question:**');
    expect(fallback).not.toContain('SOFTWARE IMPLEMENTATION');
  });

  it('caps Verified off Sol / Ultra and treats stall as a calm fallback', () => {
    expect(capVerifiedResearchModel('gpt-5.6-sol')).toBe(VERIFIED_RESEARCH_MODEL);
    expect(capVerifiedResearchModel('gpt-5.6-terra')).toBe('gpt-5.6-terra');
    expect(capVerifiedResearchModel('gpt-5.6-luna')).toBe('gpt-5.6-luna');
    expect(isResearchStallOrTimeoutError('job stalled more than allowable limit')).toBe(true);
    expect(shouldIgnorePremiumOverride('FAST')).toBe(true);
    expect(shouldIgnorePremiumOverride('GUIDANCE')).toBe(true);
    expect(shouldIgnorePremiumOverride('DEEP')).toBe(false);
  });

  it('charges 2× API cost in credits', () => {
    expect(computeResearchCreditsFromCost(0.02, 0.01)).toBe(4);
    expect(computeResearchCreditsFromCost(0.08, 0.01)).toBe(16);
    expect(computeResearchCreditsFromCost(0.2, 0.01)).toBe(40);
    expect(computeResearchCreditsFromCost(0, 0.01)).toBe(0);
  });
});


describe('substantial authorized matter context', () => {
  it('gives a short question with a judgment time to produce a substantive answer', () => {
    expect(researchDeadlineMs('FAST', 12000)).toBe(60000);
    expect(researchSynthesisTimeoutMs('FAST', 200, 12000)).toBe(45000);
    expect(researchSynthesisTimeoutMs('FAST')).toBe(12000);
  });
  it('retains bounded mode budgets for document work', () => {
    for (const mode of ['GUIDANCE', 'FAST', 'DEEP']) {
      expect(researchSynthesisTimeoutMs(mode, 200, 20000)).toBeLessThan(researchDeadlineMs(mode, 20000));
    }
    expect(researchDeadlineMs('GUIDANCE')).toBe(15000);
    expect(researchDeadlineMs('FAST')).toBe(25000);
  });
});
