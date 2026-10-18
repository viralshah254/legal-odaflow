import {
  parseActTextIntoSections,
  parseConstitutionTextIntoSections,
  htmlToPlainText,
  detectRepealStatus,
} from '@/legal-sources/parsers/india-act-text.parser';
import { IN_STATUTES } from '@/legal-search/statute-registry/in.statutes';
import type { StatuteEntry } from '@/legal-search/statute-registry/types';

describe('india-act-text.parser', () => {
  it('splits text on Section headings', () => {
    const text = `
Section 2. Definition of "dowry".
"Dowry" means any property or valuable security.

Section 3. Penalty for giving or taking dowry.
If any person gives or takes dowry, he shall be punishable.
    `.trim();

    const sections = parseActTextIntoSections(text);
    expect(sections).toHaveLength(2);
    expect(sections[0].section).toBe('2');
    expect(sections[1].section).toBe('3');
    expect(sections[1].fullText).toMatch(/Penalty for giving or taking dowry/i);
  });

  it('parses numbered Indian bare-act sections with em-dash body', () => {
    const text = `
7. Jurisdiction.—(1) Subject to the other provisions of this Act, a Family Court shall have jurisdiction.
8. Exclusion of jurisdiction and pending proceedings.—No suit shall lie.
    `.trim();

    const sections = parseActTextIntoSections(text);
    expect(sections.map((s) => s.section)).toEqual(['7', '8']);
    expect(sections[0].fullText).toMatch(/Family Court shall have jurisdiction/i);
  });

  it('strips embedded court-fees schedule tables from numbered sections', () => {
    const text = `
7. Article 15 rep. by Act 11 of 1923, sec. 3 and Sch. II.

 THE COURT-FEES ACT,1870 28

Table of Rates of ad valorem Fees Leviable on the institution of suits
When the amount or value of the subject-matter exceeds
But does not exceed
Proper fee
Rs. Rs. Rs. A. P.
5 10 0 12 0
10 15 1 2 0
8. Fee on memorandum of appeal against order relating to compensation.
The amount of fee payable under this Act on a memorandum of appeal.
    `.trim();

    const sections = parseActTextIntoSections(text);
    const section7 = sections.find((s) => s.section === '7');
    expect(section7).toBeDefined();
    expect(section7?.fullText).toBe(
      '7. Article 15 rep. by Act 11 of 1923, sec. 3 and Sch. II.',
    );
    expect(section7?.title).toBe('Article 15 rep. by Act 11 of 1923, sec. 3 and Sch. II');
    expect(section7?.fullText).not.toMatch(/Proper fee/);
  });

  it('filters to priority sections when requested', () => {
    const text = `
Section 2. Definitions.
General definitions apply.

Section 80C. Deduction for investments.
Deduction up to one lakh fifty thousand rupees.

Section 271. Penalties.
Penalty provisions apply.
    `.trim();

    const sections = parseActTextIntoSections(text, {
      prioritySections: ['80C', '271'],
    });
    expect(sections.map((s) => s.section)).toEqual(['80C', '271']);
  });

  it('strips HTML to plain text', () => {
    const html = '<p>Section 7. <strong>Jurisdiction</strong> of Family Courts.</p>';
    const plain = htmlToPlainText(html);
    expect(plain).toMatch(/Section 7/);
    expect(plain).toMatch(/Jurisdiction/);
    expect(plain).not.toMatch(/<p>/);
  });

  it('parses Constitution Article headings', () => {
    const text = `
Article 21
Protection of life and personal liberty.—No person shall be deprived of his life or personal liberty except according to procedure established by law.
    `.trim();

    const sections = parseConstitutionTextIntoSections(text);
    expect(sections[0]?.section).toBe('21');
    expect(sections[0]?.fullText).toMatch(/procedure established by law/i);
  });

  // ── detectRepealStatus tests ─────────────────────────────────────────────

  describe('detectRepealStatus', () => {
    it('detects bracketed [Omitted]', () => {
      const result = detectRepealStatus('[Omitted]');
      expect(result.isRepealed).toBe(true);
      expect(result.repealNotes).toMatch(/Omitted/i);
    });

    it('detects bracketed [Omitted by Act 45 of 2023]', () => {
      const result = detectRepealStatus('[Omitted by Act 45 of 2023]');
      expect(result.isRepealed).toBe(true);
    });

    it('detects bracketed [Repealed]', () => {
      const result = detectRepealStatus('[Repealed]');
      expect(result.isRepealed).toBe(true);
    });

    it('detects bracketed [Rep. by Act 32 of 2019]', () => {
      const result = detectRepealStatus('[Rep. by Act 32 of 2019]');
      expect(result.isRepealed).toBe(true);
    });

    it('detects "Rep. by Act ..." at start of text', () => {
      const result = detectRepealStatus('Rep. by Act 23 of 2004, s. 12.');
      expect(result.isRepealed).toBe(true);
    });

    it('detects "Repealed by Act ..."', () => {
      const result = detectRepealStatus('Repealed by Act 45 of 2023.');
      expect(result.isRepealed).toBe(true);
    });

    it('detects "Omitted by Act ..."', () => {
      const result = detectRepealStatus('Omitted by Act 7 of 2002.');
      expect(result.isRepealed).toBe(true);
    });

    it('detects "Omitted by the ..."', () => {
      const result = detectRepealStatus('Omitted by the Amendment Act, 2020.');
      expect(result.isRepealed).toBe(true);
    });

    it('detects "Section omitted"', () => {
      const result = detectRepealStatus('Section omitted by Act of 2015.');
      expect(result.isRepealed).toBe(true);
    });

    it('detects "This section has been omitted"', () => {
      const result = detectRepealStatus('This section has been omitted.');
      expect(result.isRepealed).toBe(true);
    });

    it('detects "This section was omitted"', () => {
      const result = detectRepealStatus('This section was omitted.');
      expect(result.isRepealed).toBe(true);
    });

    it('detects "This section has been repealed"', () => {
      const result = detectRepealStatus('This section has been repealed.');
      expect(result.isRepealed).toBe(true);
    });

    it('does NOT false-positive on "power to repeal rules"', () => {
      const result = detectRepealStatus(
        'The Central Government shall have power to repeal rules made under this Act.',
      );
      expect(result.isRepealed).toBe(false);
    });

    it('does NOT false-positive on contextual use of "repeal" mid-sentence', () => {
      const result = detectRepealStatus(
        'No provision of this Act shall be construed to repeal or modify any other Act.',
      );
      expect(result.isRepealed).toBe(false);
    });

    it('returns isRepealed: false and no repealNotes for a normal section', () => {
      const result = detectRepealStatus(
        'Every person who contravenes the provisions of this section shall be liable to a fine.',
      );
      expect(result.isRepealed).toBe(false);
      expect(result.repealNotes).toBeUndefined();
    });

    it('does NOT false-positive on live Contract Act s.23 operative text', () => {
      const result = detectRepealStatus(
        '23. What considerations and objects are lawful, and what not.—The consideration or object of an agreement is lawful, unless—\n(it is forbidden by law; or is of such a nature that, if permitted, it would defeat the provisions of any law; or is fraudulent; or involves or implies injury to the person or property of another; or the Court regards it as immoral, or opposed to public policy.)',
      );
      expect(result.isRepealed).toBe(false);
    });

    it('does NOT false-positive on mid-body footnote [Omitted] cross-reference', () => {
      const result = detectRepealStatus(
        'The consideration or object of an agreement is lawful unless forbidden by law.\n\nNote: See [Omitted] provision in the Finance Act, 2018 for unrelated amendments.',
      );
      expect(result.isRepealed).toBe(false);
    });
  });

  // ── StatuteEntry schedule metadata tests ─────────────────────────────────

  describe('StatuteEntry schedule metadata', () => {
    it('StatuteEntry type accepts hasSchedules, scheduleCount, scheduleNames', () => {
      const entry: StatuteEntry = {
        id: 'test-act',
        countryCode: 'IN',
        acronyms: ['TA'],
        fullName: 'Test Act, 2000',
        shortName: 'Test Act',
        year: 2000,
        practiceAreas: ['criminal'],
        searchAliases: [],
        hasSchedules: true,
        scheduleCount: 3,
        scheduleNames: ['Schedule I', 'Schedule II', 'Schedule III'],
      };
      expect(entry.hasSchedules).toBe(true);
      expect(entry.scheduleCount).toBe(3);
      expect(entry.scheduleNames).toHaveLength(3);
    });
  });

  // ── Registry completeness tests ───────────────────────────────────────────

  describe('IN_STATUTES registry', () => {
    const slugs = IN_STATUTES.map((s) => s.id);

    const expectedNewSlugs = [
      'uapa', 'nia-act-2008', 'afspa', 'official-secrets-act',
      'pitndps-act', 'armed-forces-tribunal-act',
      'indian-forest-act', 'forest-conservation-act', 'wildlife-protection-act',
      'public-liability-insurance-act', 'compensatory-afforestation-fund-act',
      'biological-diversity-act', 'muslim-women-rights-on-marriage-act',
      'shariat-application-act', 'indian-stamp-act', 'pmla',
      'benami-transactions-act', 'black-money-act', 'central-excise-act',
      'banking-regulation-act', 'rbi-act', 'sarfaesi-act', 'insurance-act',
      'trade-unions-act', 'industrial-employment-standing-orders-act',
      'factories-act', 'contract-labour-act', 'equal-remuneration-act',
      'ppvfr-act', 'semiconductor-layout-design-act',
      'telecommunications-act-2023', 'electricity-act', 'railways-act',
      'pngrb-act', 'merchant-shipping-act', 'customs-act', 'mmdr-act',
      'warehousing-development-regulation-act', 'advocates-act',
      'lokpal-lokayuktas-act', 'mental-healthcare-act', 'rpwd-act',
      'court-fees-act', 'legal-metrology-act', 'national-food-security-act',
      'disaster-management-act', 'mtp-act', 'thota-act',
      'surrogacy-regulation-act', 'art-regulation-act',
    ];

    it.each(expectedNewSlugs)('contains new slug: %s', (slug) => {
      expect(slugs).toContain(slug);
    });

    it('constitution has hasSchedules and scheduleCount 12', () => {
      const c = IN_STATUTES.find((s) => s.id === 'constitution');
      expect(c?.hasSchedules).toBe(true);
      expect(c?.scheduleCount).toBe(12);
    });

    it('companies-act has hasSchedules and scheduleCount 7', () => {
      const c = IN_STATUTES.find((s) => s.id === 'companies-act');
      expect(c?.hasSchedules).toBe(true);
      expect(c?.scheduleCount).toBe(7);
    });

    it('income-tax has hasSchedules', () => {
      const c = IN_STATUTES.find((s) => s.id === 'income-tax');
      expect(c?.hasSchedules).toBe(true);
      expect(c?.sectionCount).toBeGreaterThanOrEqual(298);
    });

    it('gst-act has hasSchedules', () => {
      const c = IN_STATUTES.find((s) => s.id === 'gst-act');
      expect(c?.hasSchedules).toBe(true);
    });

    it('contract-act sectionCount includes at least the canonical provisions', () => {
      const c = IN_STATUTES.find((s) => s.id === 'contract-act');
      expect(c?.sectionCount).toBeGreaterThanOrEqual(238);
    });

    it('arbitration-act sectionCount includes at least the canonical provisions', () => {
      const c = IN_STATUTES.find((s) => s.id === 'arbitration-act');
      expect(c?.sectionCount).toBeGreaterThanOrEqual(87);
    });
  });
});
