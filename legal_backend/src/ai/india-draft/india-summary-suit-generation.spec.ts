import { INDIA_DRAFT_SYSTEM_PROMPTS } from './india-draft-prompts';
import { INDIA_RICH_PROMPT_OVERRIDES } from '../drafting/templates/india-tier1';
import { getSkeletonForKind } from '../drafting/structural-references/india-reference-skeletons';
import { DraftKindPlaybookService } from '../drafting/playbooks/draft-kind-playbook.service';

describe('India commercial summary-suit generation contract', () => {
  const kind = 'india_suit_recovery_cpc_37';

  it('requires filing-grade structure and fact-fidelity in both prompt layers', () => {
    const prompts = [INDIA_DRAFT_SYSTEM_PROMPTS[kind], INDIA_RICH_PROMPT_OVERRIDES[kind]];

    for (const prompt of prompts) {
      expect(prompt).toContain('Order XXXVII');
      expect(prompt).toContain('Section 12A');
      expect(prompt).toMatch(/Statement of Truth/i);
      expect(prompt).toMatch(/invoice-wise/i);
      expect(prompt).toMatch(/court fee/i);
      expect(prompt).toMatch(/\[BLANK:/);
      expect(prompt).toMatch(/never invent/i);
    }
  });

  it('provides a complete Commercial Court structural skeleton', () => {
    const skeleton = getSkeletonForKind(kind);

    expect(skeleton).not.toBeNull();
    expect(skeleton?.causeTitleVehicle).toContain('ORDER XXXVII');
    expect(skeleton?.petitionerDesignator).toBe('Plaintiff');
    expect(skeleton?.respondentDesignator).toBe('Defendant');
    expect(skeleton?.mandatorySections).toEqual(
      expect.arrayContaining([
        'CPC Order XXXVII Rules 1–2',
        'Commercial Courts Act 2015 §12A',
        'Commercial Courts Act 2015 Statement of Truth',
      ]),
    );
    expect(skeleton?.referenceText).toContain('STATEMENT OF ACCOUNT / INVOICE-WISE SCHEDULE');
    expect(skeleton?.referenceText).toContain('INDEX AND LIST OF ANNEXURES');
  });

  it('resolves a strict kind-specific filing playbook', () => {
    const playbook = new DraftKindPlaybookService().resolve(kind);

    expect(playbook.kind).toBe(kind);
    expect(playbook.filingGrade).toBe(true);
    expect(playbook.factCoverageThreshold).toBeGreaterThanOrEqual(0.9);
    expect(playbook.requiredSections).toEqual(
      expect.arrayContaining([
        'MAINTAINABILITY',
        'JURISDICTION',
        'VALUATION AND COURT FEE',
        'SECTION 12A',
        'INVOICE-WISE SCHEDULE',
        'STATEMENT OF TRUTH',
        'INDEX AND LIST OF ANNEXURES',
      ]),
    );
    expect(playbook.prohibitedAssertions).toContain('unsupported_monetary_total');
  });
});
