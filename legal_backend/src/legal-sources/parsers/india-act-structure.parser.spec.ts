import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';
import pdfParse from 'pdf-parse';
import {
  extractArrangementIds,
  parseActTextIntoProvisions,
} from './india-act-structure.parser';
import {
  assessActSectionQuality,
  isHeadingOnlySection,
} from './india-act-text.parser';

const TIER1_EXPECTATIONS: Record<
  string,
  { sections?: number; orders?: number; schedules?: number }
> = {
  bns: { sections: 358 },
  bnss: { sections: 531 },
  bsa: { sections: 170 },
  ipc: { sections: 570 },
  cpc: { sections: 168, orders: 51 },
  'motor-vehicles-act-1988': { sections: 223 },
  'gst-act-2017': { sections: 176, schedules: 3 },
};

async function parseBundledAct(manifestActId: string) {
  const pdfPath = resolve(process.cwd(), `corpus/in/india-code/${manifestActId}.pdf`);
  if (!existsSync(pdfPath)) {
    throw new Error(`Missing bundled PDF: ${pdfPath}`);
  }
  const parsed = await pdfParse(readFileSync(pdfPath));
  return parseActTextIntoProvisions(parsed.text);
}

const corpusAvailable = existsSync(resolve(process.cwd(), 'corpus/in/india-code'));
const corpusIt = corpusAvailable ? it : it.skip;

describe('india-act-structure.parser', () => {
  it('extracts CPC section IDs without stopping at PART I in arrangement', () => {
    const sample = `
ARRANGEMENT OF SECTIONS
SECTIONS
1. Short title.
2. Definitions.
PART I
Suits in general
3. One suit for one cause of action.
4. Frame of suit.
`;
    const { sections } = extractArrangementIds(sample);
    expect(sections.length).toBeGreaterThanOrEqual(4);
    expect(sections).toContain('1');
    expect(sections).toContain('4');
  });

  it('extracts order IDs from arrangement block', () => {
    const sample = `
ARRANGEMENT OF ORDERS
ORDER I. Parties to suits
ORDER VII. Plaint
ORDER LI. Rules
`;
    const { orders } = extractArrangementIds(sample);
    expect(orders).toContain('I');
    expect(orders).toContain('VII');
    expect(orders).toContain('LI');
  });

  it('prefers body occurrences after duplicate arrangement headings', () => {
    const sample = `
ARRANGEMENT OF SECTIONS
1. Short title.
ACT NO. 12 OF 2020
2. Definitions.
An Act to provide for a parser regression fixture.
BE it enacted by Parliament as follows:—
1. Short title.—This Act may be called the Parser Fixture Act, 2020.
2. Definitions.—In this Act, "record" means a legal record used for testing.
`;
    const first = parseActTextIntoProvisions(sample).provisions;
    const second = parseActTextIntoProvisions(sample).provisions;
    expect(first).toEqual(second);
    expect(first.find((section) => section.provisionId === '1')?.fullText).toContain(
      'may be called the Parser Fixture Act',
    );
    expect(first.find((section) => section.provisionId === '2')?.fullText).toContain(
      '"record" means a legal record',
    );
  });

  it('rejects heading-only text but retains terse operative provisions', () => {
    expect(
      isHeadingOnlySection({
        section: '1',
        title: 'Short title.',
        fullText: '1. Short title.',
      }),
    ).toBe(true);
    expect(
      isHeadingOnlySection({
        section: '1',
        title: 'Commencement',
        fullText: '1. Commencement.—It shall come into force at once.',
      }),
    ).toBe(false);
  });

  describe.each(Object.entries(TIER1_EXPECTATIONS))(
    'tier-1 bundled PDF %s',
    (actId, expected) => {
      corpusIt(`matches expected structure counts and stub ratio`, async () => {
        const { structure, provisions, quality: parseQuality } = await parseBundledAct(actId);
        if (expected.sections != null) {
          expect(structure.sections?.count).toBe(expected.sections);
        }
        if (expected.orders != null) {
          expect(structure.orders?.count).toBe(expected.orders);
        }
        if (expected.schedules != null) {
          expect(structure.schedules?.count).toBe(expected.schedules);
        }
        const sections = provisions
          .filter((provision) => provision.provisionType === 'section')
          .map((provision) => ({
            section: provision.provisionId,
            title: provision.title,
            fullText: provision.fullText,
            isRepealed: provision.isRepealed,
          }));
        expect(
          assessActSectionQuality(sections, {
            additionalHeadingOnly: parseQuality.rejectedHeadingOnlySections,
          }).stubRatio,
        ).toBeLessThan(0.2);
      }, 60_000);
    },
  );

  corpusIt('contains the BSA section 63 golden phrase', async () => {
    const { provisions } = await parseBundledAct('bsa');
    const section = provisions.find(
      (provision) => provision.provisionType === 'section' && provision.provisionId === '63',
    );
    expect(section?.fullText).toMatch(/shall\s+be\s+deemed\s+to\s+be\s+also\s+a\s+document/i);
  }, 60_000);

  corpusIt('contains the Consumer Protection Act section 35 golden phrase', async () => {
    const { provisions } = await parseBundledAct('consumer-protection-act-2019');
    const section = provisions.find(
      (provision) => provision.provisionType === 'section' && provision.provisionId === '35',
    );
    expect(section?.fullText).toMatch(/complaint[\s\S]*goods\s+sold\s+or\s+delivered/i);
  }, 60_000);

  corpusIt('keeps every bundled India Code act below the ingest stub threshold', async () => {
    const corpusDir = resolve(process.cwd(), 'corpus/in/india-code');
    const actIds = readdirSync(corpusDir)
      .filter((name) => name.toLowerCase().endsWith('.pdf'))
      .map((name) => name.replace(/\.pdf$/i, ''))
      .sort();

    expect(actIds).toHaveLength(116);

    for (const actId of actIds) {
      const { provisions, quality: parseQuality } = await parseBundledAct(actId);
      const sections = provisions
        .filter((provision) => provision.provisionType === 'section')
        .map((provision) => ({
          section: provision.provisionId,
          title: provision.title,
          fullText: provision.fullText,
          isRepealed: provision.isRepealed,
        }));
      const quality = assessActSectionQuality(sections, {
        additionalHeadingOnly: parseQuality.rejectedHeadingOnlySections,
      });

      expect({
        actId,
        total: quality.total,
        usable: quality.usable,
        stubRatio: quality.stubRatio,
      }).toEqual(
        expect.objectContaining({
          total: expect.any(Number),
          usable: expect.any(Number),
          stubRatio: expect.any(Number),
        }),
      );
      expect(quality.acceptable).toBe(true);
    }
  }, 120_000);
});
