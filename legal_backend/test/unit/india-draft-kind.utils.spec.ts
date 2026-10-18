import { ensureIndiaDraftKind, resolveIndiaDraftFormatPrompt } from '@/ai/india-draft/india-draft-kind.utils';
import { INDIA_DRAFT_SYSTEM_PROMPTS } from '@/ai/india-draft/india-draft-prompts';

describe('india-draft-kind.utils', () => {
  it('normalizes civil_plaint to india_civil_plaint', () => {
    expect(ensureIndiaDraftKind('civil_plaint')).toBe('india_civil_plaint');
    expect(ensureIndiaDraftKind('india_civil_plaint')).toBe('india_civil_plaint');
  });

  it('resolves india_civil_plaint format prompt from registry or tier-1', () => {
    const prompt = resolveIndiaDraftFormatPrompt('india_civil_plaint', INDIA_DRAFT_SYSTEM_PROMPTS);
    expect(prompt).toContain('Plaint');
    expect(prompt.length).toBeGreaterThan(50);
  });

  it('falls back to india_custom when kind is unknown', () => {
    const prompt = resolveIndiaDraftFormatPrompt('india_totally_unknown_kind', INDIA_DRAFT_SYSTEM_PROMPTS);
    expect(prompt).toContain('Draft the legal document');
  });
});
