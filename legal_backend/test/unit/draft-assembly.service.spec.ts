import {
  DraftAssemblyService,
  dedupeSectionHeader,
  formatSourceCitation,
  resolveSourceReferences,
} from '@/ai/unified-drafting/assembly/draft-assembly.service';
import type { DraftExecutionPlan } from '@/ai/unified-drafting/contracts/draft-execution-plan';
import type { VerifiedSourceRegistry } from '@/ai/unified-drafting/contracts/verified-source';

const BAIL_REGISTRY: VerifiedSourceRegistry = {
  jobId: 'job-1',
  builtAt: new Date().toISOString(),
  sources: [
    {
      id: 'curated__prasanta_kumar_sarkar_v_ashis_chatterjee_2010',
      type: 'case',
      jurisdiction: 'IN',
      title: 'Prasanta Kumar Sarkar v. Ashis Chatterjee',
      citation: '(2010) 14 SCC 496',
      court: 'Supreme Court of India',
      verificationStatus: 'verified',
      contentHash: 'abc',
      bindingLevel: 'binding',
    },
    {
      id: 'curated__gurucharan_das_v_state_1978',
      type: 'case',
      jurisdiction: 'IN',
      title: 'Gurcharan Singh v. State (Delhi Administration)',
      citation: 'AIR 1978 SC 179',
      court: 'Supreme Court of India',
      verificationStatus: 'verified',
      contentHash: 'def',
      bindingLevel: 'binding',
    },
    {
      id: 'SOURCE_1',
      type: 'statute',
      jurisdiction: 'IN',
      title: 'BNSS §483',
      citation: 'BNSS §483',
      verificationStatus: 'verified',
      contentHash: 'ghi',
    },
  ],
};

function minimalPlan(sectionKeys: string[]): DraftExecutionPlan {
  return {
    jobId: 'job-1',
    documentKind: 'india_regular_bail_bnss_480',
    qualityTier: 'standard',
    sections: [],
    generationWaves: [sectionKeys],
    globalTokenBudget: 0,
    modelBudget: {
      maximumUsd: 1,
      maximumInputTokens: 100000,
      maximumOutputTokens: 50000,
      premiumModelAllowed: false,
    },
    complexityScore: {
      proceduralAmbiguity: 0,
      disputedIssues: 0,
      authorityConflict: 0,
      factualConflict: 0,
      reliefSeverity: 0,
      filingRisk: 0,
      documentLength: 0,
      total: 0,
    },
    riskLevel: 'medium',
    builtAt: new Date().toISOString(),
  };
}

describe('resolveSourceReferences', () => {
  it('replaces curated bail IDs with title + citation', () => {
    const input =
      'See [curated__prasanta_kumar_sarkar_v_ashis_chatterjee_2010] on bail factors.';
    const out = resolveSourceReferences(input, BAIL_REGISTRY);
    expect(out).toContain('Prasanta Kumar Sarkar v. Ashis Chatterjee, (2010) 14 SCC 496');
    expect(out).not.toMatch(/\[curated__/);
  });

  it('replaces SOURCE_n markers', () => {
    const out = resolveSourceReferences('Under [SOURCE_1].', BAIL_REGISTRY);
    expect(out).toBe('Under BNSS §483.');
  });

  it('unwraps unknown IDs instead of leaving brackets', () => {
    const out = resolveSourceReferences(
      'See [curated__unknown_case_2099].',
      BAIL_REGISTRY,
    );
    expect(out).toBe('See curated__unknown_case_2099.');
    expect(out).not.toMatch(/\[/);
  });
});

describe('formatSourceCitation', () => {
  it('joins title and citation', () => {
    expect(
      formatSourceCitation({
        title: 'Gurcharan Singh v. State (Delhi Administration)',
        citation: 'AIR 1978 SC 179',
      }),
    ).toBe('Gurcharan Singh v. State (Delhi Administration), AIR 1978 SC 179');
  });
});

describe('dedupeSectionHeader', () => {
  it('removes duplicate markdown section headers', () => {
    const body = '# CAUSE TITLE\n\n# CAUSE TITLE\n\nIN THE FAMILY COURT AT DELHI';
    expect(dedupeSectionHeader(body, 'Cause Title')).toBe(
      '# CAUSE TITLE\n\nIN THE FAMILY COURT AT DELHI',
    );
  });
});

describe('DraftAssemblyService', () => {
  it('resolves curated IDs in assembled fullText', async () => {
    const svc = new DraftAssemblyService();
    const assembled = await svc.assemble({
      jobId: 'job-1',
      sourceRegistry: BAIL_REGISTRY,
      executionPlan: minimalPlan(['grounds']),
      sections: [
        {
          sectionKey: 'grounds',
          sectionType: 'grounds',
          title: 'Grounds',
          status: 'generated',
          content:
            '4. Forensic inconsistency. Relied on [curated__prasanta_kumar_sarkar_v_ashis_chatterjee_2010].\n' +
            '6. No flight risk. [curated__gurucharan_das_v_state_1978].',
        },
      ],
    });

    expect(assembled.fullText).toContain('(2010) 14 SCC 496');
    expect(assembled.fullText).toContain('AIR 1978 SC 179');
    expect(assembled.fullText).not.toMatch(/\[curated__/);
    expect(assembled.citationAppendix.some((c) => c.id.startsWith('curated__'))).toBe(true);
  });
});
