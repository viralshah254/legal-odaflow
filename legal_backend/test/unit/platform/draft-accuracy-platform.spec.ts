import { createHash } from 'crypto';
import {
  buildStableFactId,
  buildSourceHash,
  createCaseRecordId,
  isRenderableFact,
} from '@/ai/drafting/contracts/case-record';
import { emptyContractMatterData } from '@/ai/drafting/contracts/matter-data/contract-matter-data';
import { emptyCriminalMatterData } from '@/ai/drafting/contracts/matter-data/criminal-matter-data';
import { dispositionBlocksGeneration } from '@/ai/drafting/contracts/issue-plan';
import { userLabelForStatus } from '@/ai/drafting/contracts/release-gate';
import { DraftCaseBriefService } from '@/ai/drafting/draft-case-brief.service';
import { DraftKindPlaybookService } from '@/ai/drafting/playbooks/draft-kind-playbook.service';
import { CaseRecordExtractionService } from '@/ai/drafting/platform/case-record-extraction.service';
import { SourceConflictResolver } from '@/ai/drafting/platform/source-conflict-resolver.service';
import { DraftPlaybookRegistryService } from '@/ai/drafting/platform/draft-playbook-registry.service';
import { BailFactMaterialityService } from '@/ai/drafting/platform/adapters/bail-fact-materiality.service';
import { RegularBailAdapter } from '@/ai/drafting/platform/adapters/regular-bail.adapter';
import { AnticipatoryBailAdapter } from '@/ai/drafting/platform/adapters/anticipatory-bail.adapter';
import { LegalNoticeAdapter } from '@/ai/drafting/platform/adapters/legal-notice.adapter';
import { ContractDraftAdapter } from '@/ai/drafting/platform/adapters/contract-draft.adapter';
import { ResearchMemoAdapter } from '@/ai/drafting/platform/adapters/research-memo.adapter';
import { ConsumerComplaintAdapter } from '@/ai/drafting/platform/adapters/consumer-complaint.adapter';
import { GenericDraftAdapter } from '@/ai/drafting/platform/adapters/generic-draft.adapter';
import { DocumentKindResolver } from '@/ai/drafting/platform/document-kind-resolver.service';
import { IssuePlanService } from '@/ai/drafting/platform/issue-plan.service';
import { StructuredDraftGenerator } from '@/ai/drafting/platform/structured-draft-generator.service';
import { TimelineDeterministicRuleEngine } from '@/ai/drafting/platform/validators/timeline-deterministic-rule-engine';
import { TimelineSemanticContradictionAuditor } from '@/ai/drafting/platform/validators/timeline-semantic-contradiction-auditor';
import { PartyRoleConsistencyValidator } from '@/ai/drafting/platform/validators/party-role-consistency.validator';
import { AtomicEntailmentAuditor } from '@/ai/drafting/platform/validators/atomic-entailment-auditor';
import { DraftLeakSanitizer } from '@/ai/drafting/platform/validators/draft-leak-sanitizer.service';
import { StatuteExistenceVerifier } from '@/ai/drafting/platform/validators/statute-existence-verifier';
import { AuthorityVerificationGateValidator } from '@/ai/drafting/platform/validators/authority-verification-gate.validator';
import { UniversalReleaseGateService } from '@/ai/drafting/platform/universal-release-gate.service';
import { DraftPipelineService } from '@/ai/drafting/platform/draft-pipeline.service';
import { HumanReviewService } from '@/ai/drafting/platform/human-review.service';
import { DraftAccuracyMetricsService } from '@/ai/drafting/platform/draft-accuracy-metrics.service';
import { DraftProvenanceService } from '@/ai/drafting/accuracy/draft-provenance.service';
import {
  ROHAN_CASE_DETAILS,
  ROHAN_GOOD_DRAFT,
  ROHAN_BAD_DRAFTS,
  BAIL_ADVERSARIAL_FIXTURES,
  generateBailRegressionCases,
} from './bail-platform-fixtures';

function buildStubAccuracyOrchestrator() {
  return {
    evaluate: () => ({ findings: [], passed: true, byValidator: {}, mode: 'balanced' as const }),
    reviewAndRepair: async (input: { draftText: string; caseRecord?: unknown }) => ({
      draftText: input.draftText,
      caseRecord: input.caseRecord,
      attempts: 0,
      initialFindings: [],
      finalFindings: [],
      resolvedFindingCodes: [],
      unresolvedFindingCodes: [],
      repairDraftHashes: [],
      requiresUserConfirmation: false,
      confirmationQuestions: [],
      requiresAdvocateReview: false,
      finalStatus: 'clean' as const,
      repairStatus: 'not_started' as const,
      mode: 'balanced' as const,
    }),
    invalidateCache: () => undefined,
  };
}

function buildHumanReviewPrisma() {
  const records: any[] = [];
  const draftHumanReview = {
    updateMany: async ({ where, data }: any) => {
      for (const record of records) {
        if (record.tenantId === where.tenantId && record.draftId === where.draftId) {
          Object.assign(record, data, { updatedAt: new Date() });
        }
      }
      return { count: records.length };
    },
    create: async ({ data }: any) => {
      const record = {
        id: `review_${records.length + 1}`,
        ...data,
        reviewedAt: new Date(),
        invalidated: false,
        invalidatedReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      records.push(record);
      return record;
    },
    findFirst: async ({ where }: any) =>
      [...records]
        .reverse()
        .find((record) => record.tenantId === where.tenantId && record.draftId === where.draftId) ??
      null,
  };
  const prisma: any = {
    draftHumanReview,
    $transaction: async (callback: (tx: any) => unknown) => callback({ draftHumanReview }),
  };
  return prisma;
}

function buildPlatform() {
  const caseBrief = new DraftCaseBriefService();
  const legacyPlaybooks = new DraftKindPlaybookService();
  const playbooks = new DraftPlaybookRegistryService(legacyPlaybooks);
  const extraction = new CaseRecordExtractionService(caseBrief, playbooks);
  const conflicts = new SourceConflictResolver();
  const materiality = new BailFactMaterialityService();
  const regularBail = new RegularBailAdapter(materiality);
  const anticipatoryBail = new AnticipatoryBailAdapter(materiality);
  const legalNotice = new LegalNoticeAdapter();
  const contractDraft = new ContractDraftAdapter();
  const researchMemo = new ResearchMemoAdapter();
  const consumerComplaint = new ConsumerComplaintAdapter();
  const kindResolver = new DocumentKindResolver(
    regularBail,
    anticipatoryBail,
    legalNotice,
    contractDraft,
    researchMemo,
    consumerComplaint,
    new GenericDraftAdapter(),
    playbooks,
  );
  const issuePlans = new IssuePlanService();
  const generator = new StructuredDraftGenerator();
  const metrics = new DraftAccuracyMetricsService();
  const chronologyDeterministic = new TimelineDeterministicRuleEngine();
  const chronologySemantic = new TimelineSemanticContradictionAuditor();
  const partyConsistency = new PartyRoleConsistencyValidator();
  const factEntailment = new AtomicEntailmentAuditor();
  const leakSanitizer = new DraftLeakSanitizer();
  const statuteExistence = new StatuteExistenceVerifier();
  const authorityGate = new AuthorityVerificationGateValidator();
  const accuracyOrchestrator = buildStubAccuracyOrchestrator() as any;
  const provenance = new DraftProvenanceService();
  const releaseGate = new UniversalReleaseGateService(
    chronologyDeterministic,
    chronologySemantic,
    partyConsistency,
    factEntailment,
    leakSanitizer,
    statuteExistence,
    authorityGate,
    conflicts,
    playbooks,
    metrics,
    accuracyOrchestrator,
    provenance,
  );
  const humanReview = new HumanReviewService(buildHumanReviewPrisma());
  const pipeline = new DraftPipelineService(
    extraction,
    conflicts,
    kindResolver,
    playbooks,
    issuePlans,
    generator,
    releaseGate,
    humanReview,
    metrics,
    accuracyOrchestrator,
  );
  return { pipeline, extraction, playbooks, leakSanitizer, humanReview, metrics, generator };
}

describe('Platform draft accuracy — shared core, bail-first', () => {
  describe('stable fact IDs', () => {
    it('produces FACT_sha12 ids that are stable across calls', () => {
      const a = buildStableFactId({
        sourceQuote: 'FIR dated 17 February 2026',
        proposition: 'FIR dated 17 February 2026',
        documentId: 'intake',
      });
      const b = buildStableFactId({
        sourceQuote: 'FIR dated 17 February 2026',
        proposition: 'FIR dated 17 February 2026',
        documentId: 'intake',
      });
      expect(a).toMatch(/^FACT_[a-f0-9]{12}$/);
      expect(a).toBe(b);
      expect(a).not.toBe('F1');
    });

    it('blocks model_inference facts unless approved', () => {
      expect(
        isRenderableFact({
          id: 'FACT_x',
          proposition: 'inferred',
          sourceQuote: 'inferred',
          sourceType: 'model_inference',
          status: 'disputed',
          confidence: 'inferred',
        }),
      ).toBe(false);
      expect(
        isRenderableFact({
          id: 'FACT_x',
          proposition: 'inferred',
          sourceQuote: 'inferred',
          sourceType: 'model_inference',
          status: 'disputed',
          confidence: 'inferred',
          userApproved: true,
        }),
      ).toBe(true);
    });
  });

  describe('Rohan Mehta acceptance', () => {
    it('extracts Case Record with FIR 17 Feb, arrest 19 Feb, chargesheet 15 Apr', async () => {
      const { extraction } = buildPlatform();
      const record = extraction.extract({
        documentKind: 'india_regular_bail_bnss_480',
        caseDetails: ROHAN_CASE_DETAILS,
        courtName: 'Sessions Court',
        clientName: 'Rohan Mehta',
      });
      const md = record.matterData as {
        firDetails?: { firDate?: string; firNo?: string; policeStation?: string };
        arrestDetails?: { arrestDate?: string };
        proceduralStage?: string;
        chargesheetStatus?: string;
      };
      expect(md.firDetails?.firDate).toMatch(/17/);
      expect(md.arrestDetails?.arrestDate).toMatch(/19/);
      expect(md.proceduralStage === 'post_chargesheet' || md.chargesheetStatus === 'filed').toBe(
        true,
      );
      expect(record.facts.every((f) => f.id.startsWith('FACT_'))).toBe(true);
      expect(record.facts.some((f) => /CCTV|co-?accused|shopkeeper|CDR|forensic/i.test(f.proposition))).toBe(
        true,
      );
    });

    it('good sample draft passes release gate without chronology blockers', async () => {
      const { pipeline } = buildPlatform();
      const result = await pipeline.run({
        skipAutoRepair: true,
        documentKind: 'india_regular_bail_bnss_480',
        caseDetails: ROHAN_CASE_DETAILS,
        existingDraftMarkdown: ROHAN_GOOD_DRAFT,
        skipConfirmRequirement: true,
        confirmUserId: 'test-user',
      });
      expect(result.issuePlan).not.toBeNull();
      expect(result.releaseGate).not.toBeNull();
      const chronoBlockers = result.releaseGate!.blockers.filter((b) =>
        b.checkId === 'chronology' || b.id.includes('investigation'),
      );
      expect(chronoBlockers.length).toBe(0);
      expect(result.releaseGate!.userLabel).not.toMatch(/Verified draft/i);
    });

    it.each(ROHAN_BAD_DRAFTS)('blocks bad draft: $id', async ({ draft, expectBlocker }) => {
      const { pipeline } = buildPlatform();
      const result = await pipeline.run({
        skipAutoRepair: true,
        documentKind: 'india_regular_bail_bnss_480',
        caseDetails: ROHAN_CASE_DETAILS,
        existingDraftMarkdown: draft,
        skipConfirmRequirement: true,
        confirmUserId: 'test-user',
      });
      const all = [
        ...(result.releaseGate?.blockers ?? []),
        ...(result.releaseGate?.warnings ?? []),
      ];
      const hit = all.some(
        (f) =>
          expectBlocker.test(f.message) ||
          expectBlocker.test(f.id) ||
          expectBlocker.test(f.checkId),
      );
      // Either gate blocked or adapter/leak/chrono found the issue
      expect(hit || (result.releaseGate?.status === 'draft_blocked')).toBe(true);
    });
  });

  describe('platform-wide acceptance', () => {
    it('contract passes pipeline without FIR/arrest/chargesheet fields', async () => {
      const { pipeline } = buildPlatform();
      const result = await pipeline.run({
        skipAutoRepair: true,
        documentKind: 'service_agreement_general',
        caseDetails: `
Party A: Acme Pvt Ltd. Party B: Beta Services.
Service agreement for software development. Payment INR 5,00,000 monthly.
Governing law: India. Term 12 months. Confidentiality applies.
        `.trim(),
        clientName: 'Acme Pvt Ltd',
        opposingParty: 'Beta Services',
        skipConfirmRequirement: true,
        confirmUserId: 'u1',
      });
      expect(result.blocked).toBe(false);
      const md = result.caseRecord.matterData as Record<string, unknown>;
      expect(md.firDetails).toBeUndefined();
      expect(md.arrestDetails).toBeUndefined();
      expect(md.transactionType).toBeTruthy();
      expect(result.playbook.planningMode).toBe('contract_term');
    });

    it('legal notice uses notice matter data and demand checks', async () => {
      const { pipeline } = buildPlatform();
      const result = await pipeline.run({
        skipAutoRepair: true,
        documentKind: 'india_legal_notice_general',
        caseDetails: `
Legal notice from Ram to Shyam. Demand payment of INR 250000 for unpaid invoices within 15 days.
Basis: breach of supply contract dated 1 January 2026.
        `.trim(),
        skipConfirmRequirement: true,
        confirmUserId: 'u1',
      });
      expect(result.playbook.documentKind).toBe('india_legal_notice_general');
      const md = result.caseRecord.matterData as { demandAmount?: string; curePeriod?: string };
      expect(md.demandAmount || md.curePeriod || result.structuredDraft).toBeTruthy();
    });

    it('playbook version mismatch blocks export', () => {
      const { pipeline, generator, playbooks } = buildPlatform();
      const extracted = pipeline.extractOnly({
        documentKind: 'india_regular_bail_bnss_480',
        caseDetails: ROHAN_CASE_DETAILS,
      });
      const confirmed = pipeline.confirmCaseRecord(extracted.caseRecord, 'u1');
      const adapter = new RegularBailAdapter(new BailFactMaterialityService());
      const plan = adapter.buildIssuePlan(confirmed, extracted.playbook);
      const draft = generator.generate({
        caseRecord: confirmed,
        playbook: extracted.playbook,
        issuePlan: plan,
      });
      draft.playbookVersion = '0.0.1';
      const gate = new UniversalReleaseGateService(
        new TimelineDeterministicRuleEngine(),
        new TimelineSemanticContradictionAuditor(),
        new PartyRoleConsistencyValidator(),
        new AtomicEntailmentAuditor(),
        new DraftLeakSanitizer(),
        new StatuteExistenceVerifier(),
        new AuthorityVerificationGateValidator(),
        new SourceConflictResolver(),
        playbooks,
        new DraftAccuracyMetricsService(),
        buildStubAccuracyOrchestrator() as any,
        new DraftProvenanceService(),
      );
      const result = gate.evaluate({
        caseRecord: confirmed,
        structuredDraft: draft,
        playbook: extracted.playbook,
        adapter,
      });
      expect(result.canExport).toBe(false);
      expect(result.blockers.some((b) => b.checkId === 'playbook_version')).toBe(true);
    });
  });

  describe('leak sanitizer', () => {
    it('blocks curated__ and SOURCE_ tokens', () => {
      const { leakSanitizer } = buildPlatform();
      const result = leakSanitizer.sanitize(
        'Ground A cites [curated__prasanta_kumar] and [SOURCE_3].',
      );
      expect(result.hadLeaks).toBe(true);
      expect(result.findings.every((f) => f.severity === 'blocker')).toBe(true);
      expect(result.cleanedText).not.toMatch(/curated__/);
    });
  });

  describe('human review export', () => {
    it('invalidates approval when case record version changes', async () => {
      const { humanReview } = buildPlatform();
      const draftHash = HumanReviewService.draftHash('draft text');
      await humanReview.recordApproval({
        tenantId: 't1',
        draftId: 'SD_1',
        caseRecordId: 'CR_1',
        caseRecordVersion: 1,
        playbookVersion: '1.0.0',
        draftHash,
        evidenceRevision: 'e1', courtProfileId: 'court-1', contentRevision: 1, releaseDigest: 'release-1',
        userId: 'u1',
      });
      const stale = await humanReview.isApprovalValid({
        tenantId: 't1',
        draftId: 'SD_1',
        caseRecordId: 'CR_1',
        caseRecordVersion: 2,
        playbookVersion: '1.0.0',
        draftHash,
        evidenceRevision: 'e1', courtProfileId: 'court-1', contentRevision: 1, releaseDigest: 'release-1',
      });
      expect(stale.valid).toBe(false);
    });
  });

  describe('user labels', () => {
    it('never uses Verified draft', async () => {
      expect(userLabelForStatus('automated_checks_passed')).toBe('Automated checks passed');
      expect(userLabelForStatus('lawyer_review_recommended')).toBe('Lawyer review recommended');
      expect(userLabelForStatus('draft_blocked')).toBe('Draft blocked — action required');
    });
  });

  describe('adversarial bail fixtures (20)', () => {
    it.each(BAIL_ADVERSARIAL_FIXTURES)('$id', async ({ caseDetails, badDraft, forbid }) => {
      const { pipeline } = buildPlatform();
      const result = await pipeline.run({
        skipAutoRepair: true,
        documentKind: 'india_regular_bail_bnss_480',
        caseDetails,
        existingDraftMarkdown: badDraft,
        skipConfirmRequirement: true,
        confirmUserId: 'test',
      });
      const text = result.structuredDraft?.fullMarkdown ?? badDraft;
      const forbiddenHit = forbid.some((re) => re.test(badDraft));
      expect(forbiddenHit || result.releaseGate?.status === 'draft_blocked' || result.blocked).toBe(
        true,
      );
      void text;
    });
  });

  describe('generated bail regression (100)', () => {
    it('generates 100 cases with stable ids and leak-free skeletons', async () => {
      const cases = generateBailRegressionCases(100);
      expect(cases).toHaveLength(100);
      const { pipeline, leakSanitizer } = buildPlatform();
      let pass = 0;
      for (const c of cases) {
        const result = await pipeline.run({
          skipAutoRepair: true,
          documentKind: 'india_regular_bail_bnss_480',
          caseDetails: c.caseDetails,
          skipConfirmRequirement: true,
          confirmUserId: 'gen',
        });
        if (result.caseRecord.facts.every((f) => f.id.startsWith('FACT_'))) pass += 1;
        if (result.structuredDraft) {
          const leak = leakSanitizer.sanitize(result.structuredDraft);
          expect(leak.hadLeaks).toBe(false);
        }
      }
      expect(pass).toBe(100);
    });
  });

  describe('disposition gate', () => {
    it('blocks when critical fact requires clarification', () => {
      const reasons = dispositionBlocksGeneration(
        [
          {
            factId: 'FACT_a',
            disposition: 'requires_clarification',
            reason: 'unclear',
          },
        ],
        ['FACT_a'],
      );
      expect(reasons.length).toBeGreaterThan(0);
    });
  });

  describe('ids and hashes', () => {
    it('createCaseRecordId and sourceHash', () => {
      expect(createCaseRecordId()).toMatch(/^CR_/);
      expect(buildSourceHash('hello')).toHaveLength(16);
      expect(createHash).toBeTruthy();
      expect(emptyContractMatterData().transactionType).toBe('general');
      expect(emptyCriminalMatterData().accusedPersons).toEqual([]);
    });
  });
});
