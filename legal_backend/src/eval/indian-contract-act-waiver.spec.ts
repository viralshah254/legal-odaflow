import { AuthorityTripleCheckService } from '@/ai/legal-research/authority-triple-check.service';
import { IndiaKanoonQueryBuilderService } from '@/ai/legal-research/india-kanoon-query-builder.service';
import { isMalformedCitation } from '@/ai/legal-research/act-family.util';
import { detectRepealStatus } from '@/legal-sources/parsers/india-act-text.parser';
import {
  CONTRACT_ACT_WAIVER_CASE_QUERIES,
  CONTRACT_ACT_WAIVER_SIBLING_SECTIONS,
  isContractActWaiverQuery,
  isProvisionTaxonomyQuery,
} from '@/legal-search/contract-act-waiver.util';

const WAIVER_QUERY =
  'Under the Indian Contract Act 1872, can sophisticated parties contract out of statutory protections via a blanket waiver? Which provisions are mandatory vs default (ss.23, 27, 28, 62, 63, 74)?';

describe('Indian Contract Act waiver research quality gates', () => {
  const tripleCheck = new AuthorityTripleCheckService();
  const ikQueryBuilder = new IndiaKanoonQueryBuilderService();

  it('detects Contract Act contracting-out queries', () => {
    expect(isContractActWaiverQuery(WAIVER_QUERY)).toBe(true);
    expect(isProvisionTaxonomyQuery(WAIVER_QUERY)).toBe(true);
    expect(isContractActWaiverQuery('What is section 138 NI Act?')).toBe(false);
  });

  it('defines sibling sections for mandatory-vs-default taxonomy', () => {
    for (const section of ['23', '27', '28', '62', '63', '74']) {
      expect(CONTRACT_ACT_WAIVER_SIBLING_SECTIONS).toContain(section);
    }
    expect(CONTRACT_ACT_WAIVER_CASE_QUERIES.length).toBeGreaterThanOrEqual(4);
  });

  it('does not mark live Contract Act s.23 as repealed when footnotes mention omitted provisions elsewhere', () => {
    const liveS23 =
      '23. What considerations and objects are lawful, and what not.—The consideration or object of an agreement is lawful, unless—\n' +
      '(it is forbidden by law; or is of such a nature that, if permitted, it would defeat the provisions of any law; or is fraudulent; or involves or implies injury to the person or property of another; or the Court regards it as immoral, or opposed to public policy.)';
    expect(detectRepealStatus(liveS23).isRepealed).toBe(false);
  });

  it('adds provision-specific IK queries for waiver research', () => {
    const plan = ikQueryBuilder.build({
      query: WAIVER_QUERY,
      countryCode: 'IN',
      legalIssues: ['contracting out', 'section 23'],
      statuteSections: ['23', '28', '74'],
    });
    expect(plan.allQueries.some((q) => /section 23.*Contract Act/i.test(q))).toBe(true);
    expect(plan.allQueries.some((q) => /section 28.*arbitration/i.test(q))).toBe(true);
    expect(plan.allQueries.some((q) => /doctypes:judgments/.test(q))).toBe(true);
  });

  it('omits proposition-irrelevant employment cases from triple-check display', async () => {
    const result = await tripleCheck.check({
      markdown:
        'See Bhawana Mishra v State of Uttarakhand (2020) on wrongful termination of government service.',
      countryCode: 'IN',
      query: WAIVER_QUERY,
      legalIssues: ['contracting out', 'mandatory vs default', 'section 23'],
      statuteSections: ['23', '27', '28', '62', '63', '74'],
      corpusAuthorities: [
        {
          title: 'Bhawana Mishra v State of Uttarakhand',
          citation: '2020 SCC OnLine Utt 123',
          summary: 'Employment termination and service rules for government employees.',
          fullText:
            'The petitioner challenged termination from government service under employment rules.',
          sourceName: 'India Kanoon',
          sourceTier: 'case_law',
          sourceUrl: 'https://indiankanoon.org/doc/bhawana',
        },
        {
          title: 'Bhawana Mishra v State of Uttarakhand',
          citation: '2020 SCC OnLine Utt 123',
          sourceName: 'India Kanoon',
          sourceTier: 'case_law',
          sourceUrl: 'https://indiankanoon.org/doc/bhawana2',
        },
        {
          title: 'Bhawana Mishra v State of Uttarakhand',
          citation: '2020 SCC OnLine Utt 123',
          sourceName: 'Official judgment portal',
          sourceTier: 'web',
          sourceUrl: 'https://example.gov.in/judgment/bhawana',
        },
      ],
    });

    expect(result.authorities.find((a) => /Bhawana/i.test(a.raw))).toBeUndefined();
    expect(result.correctedCount).toBe(0);
    expect(result.repairedMarkdown).not.toMatch(/CORRECTED/i);
  });

  it('does not cross-correct Contract Act s.23 to Income-tax Schedule VI', async () => {
    const markdown =
      'Section 23 of the Indian Contract Act bars agreements with unlawful consideration or object.';
    const result = await tripleCheck.check({
      markdown,
      countryCode: 'IN',
      query: WAIVER_QUERY,
      statuteSections: ['23'],
      corpusAuthorities: [
        {
          title: 'Income-tax Act Schedule VI',
          citation: 'Income-tax Act Schedule VI',
          summary: 'Visual effects and cinematography deductions',
          fullText: 'Schedule VI — Deductions for visual effects production.',
          sourceTier: 'primary',
        },
        {
          title: 'Income-tax Act Schedule VI',
          citation: 'Income-tax Act s.schedule-VI',
          sourceName: 'India Code',
          sourceTier: 'primary',
        },
      ],
    });

    expect(result.repairedMarkdown).toContain('Section 23 of the Indian Contract Act');
    expect(result.repairedMarkdown).not.toMatch(/schedule-VI/i);
    expect(isMalformedCitation('Income-tax Act s.schedule-VIual')).toBe(true);
    expect(
      result.authorities.every(
        (a) => !a.correctedTo || !/schedule-VI/i.test(a.correctedTo),
      ),
    ).toBe(true);
  });

  it('smoke checklist: memo shape expectations for the user waiver query', () => {
    const expectedHeadings = [
      'Executive',
      'Mandatory',
      'Default',
      'Section 23',
    ];
    const sampleMemo = [
      '## Executive answer',
      'No — parties cannot waive the Contract Act wholesale.',
      '## Mandatory vs default provisions',
      '| Section | Bucket | Can parties contract out? |',
      '| 23 | Mandatory bar | No |',
      '## Section 23 — colourable devices',
    ].join('\n');

    for (const heading of expectedHeadings) {
      expect(sampleMemo.toLowerCase()).toContain(heading.toLowerCase());
    }
    expect(sampleMemo).not.toMatch(/## Triple-check verification/i);
  });
});
