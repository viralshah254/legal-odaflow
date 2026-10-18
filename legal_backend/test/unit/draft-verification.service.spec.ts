import { Test } from '@nestjs/testing';
import { DraftVerificationService } from '@/ai/drafting/draft-verification.service';
import { BareActLookupService } from '@/legal-search/bare-act-lookup.service';
import { LegalRetrievalOrchestrator } from '@/legal-search/legal-retrieval-orchestrator.service';
import { SimilarCasesService } from '@/ai/legal-research/similar-cases.service';
import { SectionMismatchService } from '@/ai/legal-research/section-mismatch.service';
import { CitationVerificationService } from '@/ai/citations/citation-verification.service';
import { SubstanceVerificationService } from '@/ai/citations/substance-verification.service';
import { SentenceAuditService } from '@/legal-search/sentence-audit.service';
import { LegalSanityCheckService } from '@/ai/legal-research/legal-sanity-check.service';
import { VerifyClassifierService } from '@/legal-search/verify-classifier.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { UnifiedVerificationService } from '@/ai/verification/unified-verification.service';
import { DraftSectionFinderGroundingService } from '@/ai/drafting/draft-section-finder-grounding.service';

describe('DraftVerificationService', () => {
  let service: DraftVerificationService;
  let llm: { complete: jest.Mock };

  beforeEach(async () => {
    llm = { complete: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DraftVerificationService,
        {
          provide: BareActLookupService,
          useValue: { lookupExactSection: jest.fn().mockResolvedValue({ found: true }) },
        },
        {
          provide: LegalRetrievalOrchestrator,
          useValue: {
            retrieve: jest.fn().mockResolvedValue({
              authorities: [
                {
                  id: 'case-1',
                  title: 'Maintenance',
                  citation: 'AIR 2010 SC 1',
                  sourceName: 'Indian Kanoon',
                  sourceTier: 'case_law',
                  score: 0.9,
                  summary: 'BNSS 144 maintenance',
                },
              ],
            }),
          },
        },
        {
          provide: SimilarCasesService,
          useValue: {
            extractAndRank: jest.fn().mockReturnValue([
              {
                authorityId: 'case-1',
                title: 'Maintenance case',
                citation: 'AIR 2010 SC 1',
                court: 'Supreme Court',
                year: '2010',
                sourceUrl: null,
                sourceName: 'Indian Kanoon',
                summary: 'Maintenance',
                relevantSections: ['BNSS s.144'],
                relevance: null,
                bindingWeight: 'binding',
                confidence: 0.9,
                verificationStatus: 'verified',
              },
            ]),
          },
        },
        {
          provide: SectionMismatchService,
          useValue: {
            checkAndCorrect: jest.fn().mockImplementation(({ outputMarkdown }: { outputMarkdown: string }) => ({
              markdown: outputMarkdown,
              audit: { entries: [], anyCorrections: false, anyUnconfirmedMismatches: false },
            })),
          },
        },
        {
          provide: CitationVerificationService,
          useValue: {
            verifyCitations: jest.fn().mockResolvedValue({
              verified: true,
              citations: [],
              warnings: [],
              unverifiableCitations: ['AIR 1989 SC 1475'],
            }),
          },
        },
        {
          provide: SubstanceVerificationService,
          useValue: {
            checkIndiaNiActAndBnss: jest.fn().mockReturnValue({
              passed: true,
              warnings: [],
              requiresSeedVerification: false,
            }),
          },
        },
        {
          provide: SentenceAuditService,
          useValue: {
            audit: jest.fn().mockReturnValue({
              coverageRate: 0.8,
              ungroundedCount: 1,
              entries: [],
            }),
          },
        },
        {
          provide: LegalSanityCheckService,
          useValue: { check: jest.fn().mockReturnValue({ passed: true, violations: [] }) },
        },
        {
          provide: VerifyClassifierService,
          useValue: {
            classify: jest.fn().mockReturnValue({ pass: true, driftEntities: [], confidence: 0.9, reasons: [] }),
          },
        },
        { provide: LlmCompletionService, useValue: llm },
        {
          provide: UnifiedVerificationService,
          useValue: {
            runChecks: jest.fn().mockResolvedValue({
              citation: {
                verified: true,
                citations: [],
                warnings: [],
                unverifiableCitations: ['AIR 1989 SC 1475'],
              },
              substancePassed: true,
              substanceWarnings: [],
              classifierPassed: true,
              classifierReasons: [],
              sentenceAudit: { coverageRate: 0.8, ungroundedCount: 1, entries: [] },
              sectionAlignment: { passed: true, warnings: [] },
              indiaNiActBnssPassed: true,
              sanityPassed: true,
              verifiedCitationTexts: ['AIR 2010 SC 1'],
            }),
          },
        },
        {
          provide: DraftSectionFinderGroundingService,
          useValue: {
            buildContext: jest.fn().mockResolvedValue({
              queries: ['144 BNSS'],
              matches: [],
              promptBlock: '',
              verifiedSectionLabels: [],
            }),
            suggestCrosswalkFixes: jest.fn().mockReturnValue([]),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(DraftVerificationService);
  });

  it('returns extended audit with stripped citations and sentence audit', async () => {
    const wrongDraft =
      'Maintenance under Section 125 CrPC (now Section 125 of the Bharatiya Nyaya Sanhita). Cited AIR 1989 SC 1475.';

    const result = await service.verify({
      draft: wrongDraft,
      kind: 'india_maintenance_application_bnss_144',
      caseDetails: 'Wife maintenance application',
      countryCode: 'IN',
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(result.audit.strippedCitations.length).toBeGreaterThan(0);
    expect(result.audit.sentenceAudit).toBeDefined();
    expect(result.audit.verificationStatus).toBeDefined();
    expect(result.draft).not.toContain('AIR 1989 SC 1475');
  });

  it('addVerifiedCitations strips citations outside retrieved authorities', async () => {
    llm.complete.mockResolvedValue({
      content:
        'As held in AIR 2010 SC 1, maintenance is available. Also see AIR 9999 SC 9999.',
    });

    const result = await service.addVerifiedCitations({
      selectedText: 'Maintenance application under BNSS 144.',
      kind: 'india_maintenance_application_bnss_144',
      caseDetails: 'Wife maintenance',
      countryCode: 'IN',
      tenantId: 'tenant-1',
      userId: 'user-1',
      instruction: 'add_citations',
    });

    expect(result.revisedText).toContain('AIR 2010 SC 1');
    expect(result.revisedText).not.toContain('AIR 9999 SC 9999');
    expect(result.audit.strippedCitations.some((s) => s.original.includes('9999'))).toBe(true);
  });
});
