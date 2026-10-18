import {
  buildEffectiveQuery,
  buildSupplementalFromActionNotes,
  extractMatterFacts,
} from '@/ai/draft-intent/matter-fact-extractor';
import { getActionContextPrompt } from '@/ai/draft-intent/action-context-prompts';
import { RAM_VS_RIA_QUERY } from './matter-clarification.spec';

describe('buildEffectiveQuery', () => {
  it('returns base query when supplemental is empty', () => {
    expect(buildEffectiveQuery('Ram vs Ria', '')).toBe('Ram vs Ria');
    expect(buildEffectiveQuery('Ram vs Ria', '   ')).toBe('Ram vs Ria');
    expect(buildEffectiveQuery('Ram vs Ria')).toBe('Ram vs Ria');
  });

  it('merges base and supplemental with labeled block', () => {
    const merged = buildEffectiveQuery('Ram vs Ria', 'Impugned order dated 15 Feb 2025');
    expect(merged).toContain('Ram vs Ria');
    expect(merged).toContain('ADDITIONAL CONTEXT (user-provided):');
    expect(merged).toContain('Impugned order dated 15 Feb 2025');
  });

  it('truncates supplemental to 2000 characters', () => {
    const long = 'x'.repeat(2500);
    const merged = buildEffectiveQuery('base', long);
    expect(merged.length).toBeLessThan(2500);
    expect(merged).toContain('x'.repeat(2000));
    expect(merged).not.toContain('x'.repeat(2001));
  });
});

describe('buildSupplementalFromActionNotes', () => {
  it('formats per-action notes as Regarding lines', () => {
    const block = buildSupplementalFromActionNotes({
      'Obtain: Impugned Order': 'Family Court Ahmedabad, DV Act §23, 15 Feb 2025',
      'Draft: Written Statement': '',
    });
    expect(block).toBe(
      'Regarding "Obtain: Impugned Order": Family Court Ahmedabad, DV Act §23, 15 Feb 2025',
    );
  });
});

describe('getActionContextPrompt', () => {
  it('returns impugned order template for Obtain: Impugned Order', () => {
    const prompt = getActionContextPrompt('Obtain: Impugned Order');
    expect(prompt).not.toBeNull();
    expect(prompt!.actionKey).toBe('obtain_impugned_order');
    expect(prompt!.label).toContain('impugned order');
  });

  it('returns generic obtain template for other Obtain actions', () => {
    const prompt = getActionContextPrompt('Obtain: Marriage Certificate');
    expect(prompt).not.toBeNull();
    expect(prompt!.label).toContain('Marriage Certificate');
  });

  it('returns draft-step template for draft-oriented actions', () => {
    const prompt = getActionContextPrompt('Draft: Written Statement');
    expect(prompt).not.toBeNull();
    expect(prompt!.label).toContain('Tell us more');
  });
});

describe('extractMatterFacts with supplemental impugned order context', () => {
  const supplemental =
    'Impugned order: Family Court Ahmedabad, interim maintenance ₹1L under DV Act §23, dated 15 Feb 2025';

  it('extracts order details from merged query', () => {
    const merged = buildEffectiveQuery(RAM_VS_RIA_QUERY, supplemental);
    const facts = extractMatterFacts(merged);
    expect(facts.hasInterimOrder).toBe(true);
    expect(facts.hasDvCase).toBe(true);
    expect(facts.summaryLines.some((line) => /interim|order|maintenance/i.test(line))).toBe(true);
  });
});
