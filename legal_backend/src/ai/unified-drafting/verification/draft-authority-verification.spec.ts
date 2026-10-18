import { DraftAuthorityVerificationService } from './draft-authority-verification.service';
import { AuthorityIdentityService } from '@/ai/verification/authority-identity.service';
import { QuotationVerificationService } from '@/ai/verification/quotation-verification.service';
import { PropositionEntailmentService } from '@/ai/verification/proposition-entailment.service';
import { CourtHierarchyService } from '@/ai/verification/court-hierarchy.service';
import { TreatmentGraphService } from '@/ai/verification/treatment-graph.service';
import { AuthorityRetrievalPlannerService } from '@/ai/drafting/platform/authority-retrieval-planner.service';
import { DraftKindPlaybookService } from '@/ai/drafting/playbooks/draft-kind-playbook.service';
import { ConfigService } from '@nestjs/config';

describe('DraftAuthorityVerificationService', () => {
  const config = { get: () => undefined } as unknown as ConfigService;
  const service = new DraftAuthorityVerificationService(
    config,
    new AuthorityRetrievalPlannerService(),
    new DraftKindPlaybookService(),
    new AuthorityIdentityService(),
    new QuotationVerificationService(),
    new PropositionEntailmentService(),
    undefined,
    undefined,
    undefined,
  );

  const emptyRegistry = {
    jobId: 'test',
    builtAt: new Date().toISOString(),
    sources: [],
  };

  it('verifies bail draft with Sanjay Chandra cite — identity and hierarchy pass', async () => {
    const draftText = `
      GROUNDS FOR BAIL
      Bail is the rule and jail is the exception. The triple test requires the Court to consider
      flight risk and tampering. See Sanjay Chandra v. CBI (2012) 1 SCC 40.
    `;
    const result = await service.verify({
      draftText,
      documentKind: 'india_regular_bail_bnss_480',
      jurisdiction: 'IN',
      rawFacts: 'economic offence bail application',
      sourceRegistry: emptyRegistry,
    });
    const sanjay = result.citationAppendix.find((e) => e.citation.includes('Sanjay Chandra'));
    expect(sanjay).toBeDefined();
    expect(sanjay?.identityStatus).toBe('pass');
    expect(sanjay?.relevanceStatus).toBe('pass');
  });

  it('verifies consumer complaint with M.K. Gupta deficiency proposition', async () => {
    const draftText = `
      The respondent's delay in handing over possession amounts to deficiency in service under the
      Consumer Protection Act. Lucknow Development Authority v. M.K. Gupta (1994) 1 SCC 243 holds
      that deficiency includes delay and failure to provide promised amenities.
    `;
    const result = await service.verify({
      draftText,
      documentKind: 'india_consumer_complaint',
      jurisdiction: 'IN',
      rawFacts: 'housing possession delay consumer complaint',
      sourceRegistry: emptyRegistry,
    });
    const mk = result.citationAppendix.find((e) => e.citation.includes('M.K. Gupta'));
    expect(mk).toBeDefined();
    expect(mk?.identityStatus).toBe('pass');
    expect(mk?.relevanceStatus).toBe('pass');
  });

  it('verifies specific performance with Vidyanadam readiness proposition', async () => {
    const draftText = `
      The plaintiff seeks specific performance as a matter of discretion.
      K.S. Vidyanadam v. Vairavan (1997) 3 SCC 1 holds that specific performance is
      discretionary and the Court considers hardship before granting relief for immovable property.
    `;
    const result = await service.verify({
      draftText,
      documentKind: 'india_specific_performance',
      jurisdiction: 'IN',
      rawFacts: 'agreement to sell specific performance suit',
      sourceRegistry: emptyRegistry,
    });
    const vid = result.citationAppendix.find((e) => e.citation.includes('Vidyanadam'));
    expect(vid).toBeDefined();
    expect(vid?.identityStatus).toBe('pass');
    expect(vid?.relevanceStatus).toBe('pass');
  });

  it('skips case minimum for express legal notice but still checks statute cite', async () => {
    const draftText = `
      You are hereby called upon to remedy the breach within 15 days failing which legal action
      under Section 73 of the Indian Contract Act, 1872 shall be initiated.
    `;
    const result = await service.verify({
      draftText,
      documentKind: 'india_legal_notice',
      jurisdiction: 'IN',
      rawFacts: 'breach of contract notice',
      sourceRegistry: emptyRegistry,
    });
    expect(result.gate.minVerifiedCases).toBe(0);
    expect(result.gate.canExport).toBe(true);
  });

  it('flags cross-domain consumer case cited in specific performance draft', async () => {
    const draftText = `
      The plaintiff seeks specific performance of the agreement to sell immovable property.
      Lucknow Development Authority v. M.K. Gupta (1994) 1 SCC 243 is cited for readiness and
      willingness to perform the contract and grant of specific performance relief.
    `;
    const result = await service.verify({
      draftText,
      documentKind: 'india_specific_performance',
      jurisdiction: 'IN',
      rawFacts: 'agreement to sell',
      sourceRegistry: emptyRegistry,
    });
    const mk = result.citationAppendix.find((e) => e.citation.includes('M.K. Gupta'));
    expect(mk).toBeDefined();
    expect(mk?.identityStatus).toBe('pass');
    expect(['fail', 'indeterminate']).toContain(mk?.relevanceStatus);
  });

  it('verifies consumer research memo with multiple passing curated cases', async () => {
    const draftText = `
      AUTHORITIES
      1. Lucknow Development Authority v. M.K. Gupta (1994) 1 SCC 243 — deficiency in service includes delay,
      substandard performance, and failure to provide promised amenities; consumer courts have jurisdiction.
      2. National Insurance Co. Ltd. v. Nitin Khandelwal (2008) 11 SCC 259 — repudiation of insurance claim
      without proper investigation amounts to deficiency in service; insurer cannot repudiate unless breach is fundamental.
    `;
    const result = await service.verify({
      draftText,
      documentKind: 'india_consumer_research_memo',
      jurisdiction: 'IN',
      rawFacts: 'consumer insurance repudiation research',
      sourceRegistry: emptyRegistry,
    });
    expect(result.citationAppendix.length).toBeGreaterThanOrEqual(2);
    const passing = result.citationAppendix.filter(
      (e) => e.verified || service.isPassingAuthority(e),
    );
    expect(passing.length).toBeGreaterThanOrEqual(2);
  });

  it('marks orphan citations as identity fail', async () => {
    const draftText = 'The Court held in Phantom Case v. State (2099) 99 SCC 1 that bail is automatic.';
    const result = await service.verify({
      draftText,
      documentKind: 'india_regular_bail_bnss_480',
      jurisdiction: 'IN',
      sourceRegistry: emptyRegistry,
    });
    expect(result.citationAppendix.some((e) => e.identityStatus === 'fail')).toBe(true);
  });
});
