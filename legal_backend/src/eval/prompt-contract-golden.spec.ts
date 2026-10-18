import { buildAntiHallucinationContract } from '@/ai/citations/anti-hallucination-contract';
import { buildVerifiedMemoContract } from '@/ai/legal-research/research-prompt-blocks';
import { LEGAL_ACCURACY_PROTOCOL } from '@/ai/drafting/legal-accuracy-protocol';

/**
 * Golden checks on the prompt contracts themselves.
 *
 * These are the instructions that stand between a lawyer and a fabricated
 * citation. A refactor that quietly drops "quote only what you were given" from
 * one jurisdiction's prompt would not fail any other test in the suite.
 */

const COUNTRIES = ['IN', 'KE', 'US', 'GB'] as const;

describe('anti-hallucination contract (all jurisdictions, both flows)', () => {
  const REQUIRED = [
    { name: 'quote-only citation', pattern: /verbatim in a provided passage/i },
    { name: 'authority gap marker', pattern: /\[AUTHORITY GAP\]/ },
    { name: 'no invented identifiers', pattern: /NEVER INVENT IDENTIFIERS/i },
    { name: 'retrieval failure is not absence of law', pattern: /RETRIEVAL FAILURE IS NOT ABSENCE/i },
    { name: 'state the test not the outcome', pattern: /STATE THE TEST, NOT THE OUTCOME/i },
    { name: 'holding only', pattern: /ONLY THE HOLDING/i },
  ];

  describe.each(COUNTRIES)('%s', (countryCode) => {
    it.each(['research', 'drafting'] as const)('%s flow keeps every rule', (flow) => {
      const contract = buildAntiHallucinationContract({ flow, countryCode });

      for (const rule of REQUIRED) {
        expect(contract).toMatch(rule.pattern);
      }
      expect(contract).toContain(`Jurisdiction for this task: ${countryCode}`);
    });
  });

  it('tells the researcher to answer the exact question rather than narrow scope', () => {
    const contract = buildAntiHallucinationContract({ flow: 'research', countryCode: 'US' });

    expect(contract).toMatch(/Answer the exact question asked/i);
    expect(contract).toMatch(/do not ask the user to narrow scope/i);
  });

  it('does not name a single country\'s statutes as the universal rule', () => {
    const gb = buildAntiHallucinationContract({ flow: 'research', countryCode: 'GB' });

    expect(gb).not.toMatch(/\bBNSS\b|\bIPC\b|\bCrPC\b|India Kanoon/i);
  });
});

describe('verified research memo contract', () => {
  it.each(COUNTRIES)('scopes source preference to %s', (countryCode) => {
    const contract = buildVerifiedMemoContract(countryCode);

    expect(contract).toContain(`VERIFIED RESEARCH MEMO CONTRACT (${countryCode})`);
    expect(contract).toMatch(/SOURCE PREFERENCE/);
    expect(contract).toMatch(/ANSWER THE EXACT QUESTION/);
    expect(contract).toMatch(/STATE THE TEST/);
    expect(contract).toMatch(/ABSTAIN EXPLICITLY/);
  });

  it('does not push India-specific drafting rules onto other jurisdictions', () => {
    const us = buildVerifiedMemoContract('US');

    expect(us).not.toMatch(/TPA ss\.105|Olga Tellis|Indian Kanoon/i);
    expect(buildVerifiedMemoContract('IN')).toMatch(/Olga Tellis/);
  });

  it('falls back to a jurisdiction-neutral contract when no country is known', () => {
    const generic = buildVerifiedMemoContract();

    expect(generic).toContain('=== VERIFIED RESEARCH MEMO CONTRACT ===');
    expect(generic).toMatch(/official primary-law publishers for the jurisdiction/i);
  });
});

describe('drafting accuracy protocol', () => {
  it('bans fabricated reporters outside India as well as inside', () => {
    expect(LEGAL_ACCURACY_PROTOCOL).toMatch(/eKLR/);
    expect(LEGAL_ACCURACY_PROTOCOL).toMatch(/EWCA|UKSC/);
    expect(LEGAL_ACCURACY_PROTOCOL).toMatch(/F\.3d/);
  });

  it('requires the drafter to answer the instruction, state the test, and abstain openly', () => {
    expect(LEGAL_ACCURACY_PROTOCOL).toMatch(/ANSWER THE INSTRUCTION GIVEN/);
    expect(LEGAL_ACCURACY_PROTOCOL).toMatch(/STATE THE TEST/);
    expect(LEGAL_ACCURACY_PROTOCOL).toMatch(/ABSTAIN EXPLICITLY/);
  });

  it('carries the shared anti-hallucination contract rather than its own weaker copy', () => {
    expect(LEGAL_ACCURACY_PROTOCOL).toContain('=== ANTI-HALLUCINATION CONTRACT');
  });

  it('describes court hierarchy generically instead of assuming one country', () => {
    expect(LEGAL_ACCURACY_PROTOCOL).toMatch(/binding appellate\s+court for this forum/i);
    expect(LEGAL_ACCURACY_PROTOCOL).toMatch(/persuasive rather than binding/i);
  });
});
