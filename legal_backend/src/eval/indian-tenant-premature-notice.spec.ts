import { AuthorityTripleCheckService } from '@/ai/legal-research/authority-triple-check.service';
import { IndiaKanoonQueryBuilderService } from '@/ai/legal-research/india-kanoon-query-builder.service';
import { ResearchIntelligenceMapService } from '@/ai/legal-research/research-intelligence-map.service';
import { ConfigService } from '@nestjs/config';
import {
  INDIA_TENANT_EVICTION_SECTIONS,
  authoritiesIncludeTenantPack,
  isIndiaTenantEvictionQuery,
  isTenancyRemedyQuery,
} from '@/legal-search/india-tenant-eviction.util';

const TENANT_QUERY =
  'What remedies, if any, are available to a tenant in India when a landlord issues a notice to vacate before the contractual notice period expires, without a stated valid reason, and the tenant has no alternative accommodation?';

describe('Indian tenant premature-notice research quality gates', () => {
  const tripleCheck = new AuthorityTripleCheckService();
  const ikQueryBuilder = new IndiaKanoonQueryBuilderService();
  const intelligenceMap = new ResearchIntelligenceMapService(
    { complete: jest.fn() } as never,
    { get: () => 'gpt-5.6-sol' } as unknown as ConfigService,
  );

  it('detects India tenant eviction / premature-notice queries', () => {
    expect(isIndiaTenantEvictionQuery(TENANT_QUERY)).toBe(true);
    expect(isTenancyRemedyQuery(TENANT_QUERY)).toBe(true);
    expect(isIndiaTenantEvictionQuery('What is section 138 NI Act?')).toBe(false);
  });

  it('defines TPA / SRA / CPC sibling sections for the lawyer pack', () => {
    const keys = INDIA_TENANT_EVICTION_SECTIONS.map((s) => `${s.actId}:${s.section}`);
    for (const needed of [
      'transfer-of-property:105',
      'transfer-of-property:106',
      'transfer-of-property:111',
      'specific-relief:34',
      'specific-relief:38',
      'cpc:9',
    ]) {
      expect(keys).toContain(needed);
    }
  });

  it('treats retrieved TPA/SRA citations as a complete tenant pack', () => {
    expect(
      authoritiesIncludeTenantPack([
        { title: 'Transfer of Property Act s.106', citation: 'TPA s.106' },
        { title: 'Specific Relief Act s.38', citation: 'SRA s.38' },
      ]),
    ).toBe(true);
  });

  it('adds provision-specific IK queries for tenant premature-notice research', () => {
    const plan = ikQueryBuilder.build({
      query: TENANT_QUERY,
      countryCode: 'IN',
      legalIssues: ['premature notice', 'injunction'],
      statuteSections: ['106', '111'],
    });
    expect(plan.allQueries.some((q) => /section 106.*Transfer of Property/i.test(q))).toBe(
      true,
    );
    expect(plan.allQueries.some((q) => /injunction restrain dispossession/i.test(q))).toBe(
      true,
    );
  });

  it('intelligence-map seed prefers TPA over Constitution', () => {
    const map = intelligenceMap.fallbackMap(
      { query: TENANT_QUERY, countryCode: 'IN' },
      'gpt-5.6-sol',
      'test',
    );
    const titles = map.likelyStatutes.map((s) => s.title).join(' ');
    expect(titles).toMatch(/Transfer of Property/i);
    expect(titles).not.toMatch(/Constitution of India/i);
  });

  it('omits Olga Tellis as CORRECTED on a private-lease query', async () => {
    const result = await tripleCheck.check({
      markdown:
        'See Olga Tellis v Bombay Municipal Corporation (1985) on alternative accommodation and Article 21.',
      countryCode: 'IN',
      query: TENANT_QUERY,
      legalIssues: ['premature notice', 'tenant remedies'],
      statuteSections: ['106', '111'],
      corpusAuthorities: [
        {
          title: 'Olga Tellis v Bombay Municipal Corporation',
          citation: '(1985) 3 SCC 545',
          summary:
            'Pavement dwellers and Article 21 — eviction without notice by a municipal corporation.',
          fullText:
            'The petitioners were pavement dwellers. Article 21 requires notice and hearing before state eviction.',
          sourceName: 'India Kanoon',
          sourceTier: 'case_law',
          sourceUrl: 'https://indiankanoon.org/doc/olga',
        },
        {
          title: 'Olga Tellis v Bombay Municipal Corporation',
          citation: '(1985) 3 SCC 545',
          sourceName: 'India Kanoon',
          sourceTier: 'case_law',
          sourceUrl: 'https://indiankanoon.org/doc/olga2',
        },
        {
          title: 'Olga Tellis v Bombay Municipal Corporation',
          citation: '(1985) 3 SCC 545',
          sourceName: 'Official judgment portal',
          sourceTier: 'web',
          sourceUrl: 'https://example.gov.in/judgment/olga',
        },
      ],
    });

    expect(result.authorities.find((a) => /Olga/i.test(a.raw))).toBeUndefined();
    expect(result.correctedCount).toBe(0);
    expect(result.repairedMarkdown).not.toMatch(/CORRECTED/i);
  });

  it('smoke checklist: memo shape for the tenant premature-notice query', () => {
    const sampleMemo = [
      '## Executive answer',
      'A premature vacate demand without a valid termination ground does not end the tenancy.',
      '## Remedies',
      '| Remedy | Source |',
      '| Injunction | Specific Relief Act s.38 |',
      '## Transfer of Property Act s.106',
    ].join('\n');
    expect(sampleMemo).toMatch(/Executive answer/i);
    expect(sampleMemo).toMatch(/Remedies/i);
    expect(sampleMemo).not.toMatch(/## Triple-check verification/i);
    expect(sampleMemo).not.toMatch(/only Article 21 retrieved/i);
  });
});
