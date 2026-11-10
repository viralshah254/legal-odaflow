import { LegalResearchVerificationService } from './legal-research-verification.service';
import { LegalEvidencePackService } from '@/ai/legal-research/legal-evidence-pack.service';
import { ClaimLevelVerificationService } from '@/ai/legal-research/claim-level-verification.service';
import { AuthorityIdentityService } from '@/ai/verification/authority-identity.service';
import { QuotationVerificationService } from '@/ai/verification/quotation-verification.service';
import { CitationResolutionService } from '@/ai/verification/citation-resolution.service';
import { PropositionExtractionService } from '@/ai/verification/proposition-extraction.service';
import { ClaimRepairService } from '@/ai/verification/claim-repair.service';
import { PropositionEntailmentService } from '@/ai/verification/proposition-entailment.service';
import type { UnifiedVerificationResult } from '@/ai/verification/unified-verification.service';

describe('LegalResearchVerificationService', () => {
  it('does not spend the semantic evidence budget repeatedly on the same source', async () => {
    const { service, llmCompletion } = buildService();
    const propositions = Array.from({ length: 8 }, (_, i) => ({ claimId: `c${i}`, type: 'RULE', text: `Claim ${i}`, evidenceIds: ['E1'], confidence: 0.5 }));
    await (service as any).runSemanticVerificationBatch({
      modelName: 'verifier', draft: { issues: [{ propositions }] },
      evidencePack: { statutes: [{ evidenceId: 'E1', text: 'Source text '.repeat(700) }], authorities: [], officialMaterials: [], matterFacts: [] },
      initial: { claimAudits: propositions.map(p => ({ claimId: p.claimId, passageSupport: 'UNSUPPORTED' })), findings: [] },
    });
    const payload = JSON.parse(llmCompletion.complete.mock.calls[0][0].messages[1].content);
    expect(payload.lockedPassages).toHaveLength(1);
    expect(payload.passageTasks).toHaveLength(8);
    expect(payload.passageTasks.every((task: any) => task.evidenceIds[0] === 'E1')).toBe(true);
  });
  function failClosedUnifiedResult(
    overrides: Partial<UnifiedVerificationResult> = {},
  ): UnifiedVerificationResult {
    return {
      citation: {
        verified: false,
        citations: [],
        warnings: ['Citation verification unavailable.'],
        unverifiableCitations: ['citation-verifier-unavailable'],
      },
      substancePassed: false,
      substanceWarnings: ['Substance verification unavailable.'],
      classifierPassed: true,
      classifierReasons: [],
      sentenceAudit: { coverageRate: 0, entries: [], ungroundedCount: 1 },
      sectionAlignment: { passed: true, warnings: [] },
      indiaNiActBnssPassed: true,
      sanityPassed: true,
      verifiedCitationTexts: [],
      verificationUnavailable: true,
      ...overrides,
    };
  }

  function cleanUnifiedResult(
    overrides: Partial<UnifiedVerificationResult> = {},
  ): Partial<UnifiedVerificationResult> {
    return {
      verificationUnavailable: false,
      substancePassed: true,
      substanceWarnings: [],
      classifierPassed: true,
      sentenceAudit: { coverageRate: 1, entries: [], ungroundedCount: 0 },
      sectionAlignment: { passed: true, warnings: [] },
      citation: { verified: true, citations: [], warnings: [], unverifiableCitations: [] },
      ...overrides,
    };
  }

  function buildService(
    unifiedOverrides?: Partial<UnifiedVerificationResult>,
    llmResult?: string | Error,
    adversarialVerify?: jest.Mock,
  ) {
    const unified = {
      runChecks: jest.fn().mockResolvedValue(failClosedUnifiedResult(unifiedOverrides)),
      buildCorrectionPrompt: jest.fn(),
      shouldRegenerate: jest.fn(),
    };
    const llmCompletion = {
      complete:
        llmResult instanceof Error
          ? jest.fn().mockRejectedValue(llmResult)
          : jest.fn().mockResolvedValue({
              content: llmResult ?? '{"claims":[],"identities":[]}',
            }),
    };

    const adversarial = {
      verify:
        adversarialVerify ??
        jest.fn().mockResolvedValue({ findings: [], uncertaintyReported: false }),
    };

    return {
      adversarial,
      service: new LegalResearchVerificationService(
        {
          checkBareActSubstance: jest.fn().mockReturnValue({
            passed: true,
            warnings: [],
            requiresSeedVerification: false,
          }),
          checkIndiaNiActAndBnss: jest.fn().mockReturnValue({ passed: true, warnings: [] }),
        } as never,
        llmCompletion as never,
        new LegalEvidencePackService(),
        new ClaimLevelVerificationService(
          new AuthorityIdentityService(),
          new QuotationVerificationService(),
          new PropositionEntailmentService(),
        ),
        new PropositionExtractionService(
          new CitationResolutionService(new AuthorityIdentityService()),
        ),
        new ClaimRepairService(),
        unified as never,
        adversarial as never,
        { recordPipelineGaps: jest.fn().mockResolvedValue(undefined) } as never,
      ),
      unified,
      llmCompletion,
    };
  }

  it('fails closed when unified verification reports unavailable', async () => {
    const { service } = buildService();
    const result = await service.verifyAndPublish({
      query: 'bail test',
      outputMarkdown: 'Bail depends on flight risk and witness tampering.',
      authorities: [],
      isBareActQuery: false,
      countryCode: 'IN',
    });

    expect(result.provenance.requiresLawyerReview).toBe(true);
    expect(result.publicationState).toBe('VERIFICATION_UNAVAILABLE');
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: 'system:verification_unavailable',
          state: 'INDETERMINATE',
          severity: 'BLOCKER',
        }),
      ]),
    );
    expect(result.outputHash).toHaveLength(64);
  });

  describe('independent self-verification escalation', () => {
    const authority = {
      id: 'auth_1',
      title: 'Eval Bail Case',
      citation: '(2024) 1 SCC 99',
      sourceName: 'Supreme Court',
      sourceTier: 'case_law' as const,
      summary: 'Bail requires assessment of flight risk and witness tampering.',
      fullText: 'Bail requires assessment of flight risk and witness tampering.',
    };

    it('escalates to the LLM verifier when deterministic checks leave unverifiable citations', async () => {
      const { service, adversarial } = buildService(
        cleanUnifiedResult({
          citation: {
            verified: false,
            citations: [],
            warnings: ['unverifiable'],
            unverifiableCitations: ['(2019) 4 SCC 1'],
          },
        }),
      );

      const result = await service.verifyAndPublish({
        query: 'judicial review standard',
        outputMarkdown: 'Judicial review is available where the decision is unreasonable.',
        authorities: [authority],
        isBareActQuery: false,
        // A non-India jurisdiction must get the same escalation.
        countryCode: 'GB',
        verifierModel: 'verifier-model',
      });

      expect(adversarial.verify).toHaveBeenCalledTimes(1);
      expect(result.selfVerification).toMatchObject({
        ran: true,
        escalationReason: 'unverifiable-citations',
      });
    });

    it('does not spend a verifier call when nothing material is outstanding', () => {
      const { service } = buildService(cleanUnifiedResult());
      const decide = (
        service as unknown as {
          resolveLlmVerifierEscalation: (args: unknown) => { run: boolean; reason?: string };
        }
      ).resolveLlmVerifierEscalation.bind(service);

      const clean = {
        input: { verifierModel: 'verifier-model', runLlmAdversarialVerify: false },
        finalChecks: {
          substancePassed: true,
          sectionAlignment: { passed: true },
          citation: { unverifiableCitations: [], rejectedCitations: [] },
        },
        claimVerification: { unsupportedKeyClaims: [], verificationStatus: 'VERIFIED' },
        findings: [],
      };

      expect(decide(clean)).toEqual({ run: false });
      // Without a verifier model there is nothing to escalate to.
      expect(decide({ ...clean, input: { runLlmAdversarialVerify: true } })).toEqual({ run: false });
      // A material unresolved finding escalates, in any jurisdiction.
      expect(
        decide({
          ...clean,
          findings: [{ state: 'FAIL', severity: 'HIGH', dimension: 'passage' }],
        }),
      ).toEqual({ run: true, reason: 'material-finding:passage' });
    });

    it('always runs when the caller marks the path as serious', async () => {
      const { service, adversarial } = buildService(cleanUnifiedResult());

      await service.verifyAndPublish({
        query: 'bail test with enough detail for fact extraction.',
        outputMarkdown: 'Bail requires assessment of flight risk and witness tampering.',
        authorities: [authority],
        isBareActQuery: false,
        countryCode: 'KE',
        verifierModel: 'verifier-model',
        runLlmAdversarialVerify: true,
      });

      expect(adversarial.verify).toHaveBeenCalledTimes(1);
    });

    it('routes a HIGH self-verification failure to lawyer review', async () => {
      const { service } = buildService(
        cleanUnifiedResult(),
        undefined,
        jest.fn().mockResolvedValue({
          uncertaintyReported: true,
          findings: [
            {
              checkId: 'research:llm-adversarial:1',
              state: 'FAIL',
              severity: 'HIGH',
              dimension: 'passage',
              evidenceIds: [],
              explanation: 'Dispositive claim is not supported by the cited passage.',
              repairAction: 'QUALIFY',
              verifierVersion: 'legal-research-llm-verifier-v1',
            },
          ],
        }),
      );

      const result = await service.verifyAndPublish({
        query: 'bail test with enough detail for fact extraction.',
        outputMarkdown: 'Bail requires assessment of flight risk and witness tampering.',
        authorities: [authority],
        isBareActQuery: false,
        countryCode: 'US',
        verifierModel: 'verifier-model',
        runLlmAdversarialVerify: true,
      });

      expect(result.provenance.requiresLawyerReview).toBe(true);
      expect(result.selfVerification?.materialFindingCount).toBeGreaterThan(0);
    });
  });

  it('re-runs final audit after claim repair mutations', async () => {
    const { service, unified } = buildService({
      verificationUnavailable: false,
      substancePassed: true,
      substanceWarnings: [],
      sentenceAudit: { coverageRate: 1, entries: [], ungroundedCount: 0 },
      citation: {
        verified: true,
        citations: [],
        warnings: [],
        unverifiableCitations: [],
      },
    });

    await service.verifyAndPublish({
      query: 'bail test with enough detail for fact extraction.',
      outputMarkdown: 'Bail depends on flight risk and witness tampering under settled principles.',
      authorities: [
        {
          id: 'auth_1',
          title: 'Eval Bail Case',
          citation: '(2024) 1 SCC 99',
          sourceName: 'Supreme Court',
          sourceTier: 'case_law',
          summary: 'Bail requires assessment of flight risk and witness tampering.',
          fullText: 'Bail requires assessment of flight risk and witness tampering.',
        },
      ],
      isBareActQuery: false,
      countryCode: 'IN',
    });

    // Initial checks + final checks after claim stage (at least 2).
    expect(unified.runChecks.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('does not instruct regeneration to use model or training knowledge as authority', () => {
    const { service } = buildService();
    const prompt = (
      service as unknown as {
        buildCorrectionPrompt: (input: unknown, verification: unknown) => string;
      }
    ).buildCorrectionPrompt(
      {
        query: 'missing section',
        authorities: [],
      },
      {
        substanceWarnings: [],
        sectionAlignment: { warnings: [] },
        citation: { unverifiableCitations: [] },
        sentenceAudit: { ungroundedCount: 0 },
      },
    );

    expect(prompt).not.toMatch(/training knowledge|model knowledge/i);
    expect(prompt).toContain('do not use unstated sources as legal authority');
  });

  it('exposes unsupported material claims for one bounded retrieval-repair handoff', async () => {
    const { service } = buildService({
      verificationUnavailable: false,
      substancePassed: true,
      substanceWarnings: [],
      sentenceAudit: { coverageRate: 1, entries: [], ungroundedCount: 0 },
      citation: {
        verified: true,
        citations: [],
        warnings: [],
        unverifiableCitations: [],
      },
    });
    const result = await service.verifyAndPublish({
      query: 'When is bail automatic?',
      outputMarkdown: 'Bail is automatic.',
      authorities: [],
      isBareActQuery: false,
      countryCode: 'IN',
      structuredDraft: {
        directAnswer: { text: 'Bail is automatic.', confidence: 0.4 },
        issues: [
          {
            issueId: 'bail',
            heading: 'Bail',
            conclusion: 'Unverified',
            propositions: [
              {
                claimId: 'automatic_bail',
                text: 'Bail is automatic.',
                type: 'RULE',
                evidenceIds: [],
                confidence: 0.4,
              },
            ],
          },
        ],
        practicalSteps: [],
        limitations: [],
        unansweredQuestions: [],
      },
    });

    expect(result.unsupportedKeyClaims).toEqual([
      expect.objectContaining({
        issueId: 'bail',
        claimId: 'automatic_bail',
        supportState: 'INDETERMINATE',
      }),
    ]);
  });

  it('rescues a supported legal paraphrase through one batched LLM pass', async () => {
    const evidenceId = 'EVD_AUTH_1_P1';
    const { service, llmCompletion } = buildService(
      {
        verificationUnavailable: false,
        substancePassed: true,
        substanceWarnings: [],
        sentenceAudit: { coverageRate: 1, entries: [], ungroundedCount: 0 },
        citation: {
          verified: true,
          citations: [],
          warnings: [],
          unverifiableCitations: [],
        },
      },
      JSON.stringify({
        claims: [
          {
            claimId: 'paraphrase',
            supportState: 'SUPPORTED',
            evidenceIds: [evidenceId],
            confidence: 0.93,
          },
        ],
        identities: [],
      }),
    );

    const result = await service.verifyAndPublish({
      query: 'What factors govern pretrial liberty?',
      outputMarkdown: 'Pretrial liberty turns on evasion and interference risks.',
      authorities: [
        {
          id: 'auth_1',
          title: 'Bail Factors Case',
          citation: '(2024) 1 SCC 10',
          sourceName: 'Supreme Court',
          sourceTier: 'case_law',
          summary: 'Bail depends on flight risk and witness tampering.',
          fullText: 'Bail depends on flight risk and witness tampering.',
        },
      ],
      isBareActQuery: false,
      countryCode: 'IN',
      verifierModel: 'cheap-verifier',
      structuredDraft: {
        directAnswer: { text: 'Pretrial liberty is risk-dependent.', confidence: 0.7 },
        issues: [
          {
            issueId: 'bail',
            heading: 'Bail',
            conclusion: 'Risk-dependent',
            propositions: [
              {
                claimId: 'paraphrase',
                text: 'Pretrial liberty turns on likelihood of evasion and interference with testimony.',
                type: 'RULE',
                evidenceIds: [evidenceId],
                confidence: 0.7,
              },
            ],
          },
        ],
        practicalSteps: [],
        limitations: [],
        unansweredQuestions: [],
      },
    });

    expect(llmCompletion.complete).toHaveBeenCalledTimes(1);
    expect(llmCompletion.complete).toHaveBeenCalledWith(
      expect.objectContaining({ modelName: 'cheap-verifier', temperature: 0 }),
    );
    expect(result.propositions).toEqual([
      expect.objectContaining({ id: 'paraphrase', supportState: 'SUPPORTED' }),
    ]);
    expect(result.unsupportedKeyClaims).toEqual([]);
  });

  it('rejects a hallucinated authority identity from the semantic batch', async () => {
    const { service, llmCompletion } = buildService(
      undefined,
      JSON.stringify({
        claims: [],
        identities: [
          {
            claimId: 'identity_claim',
            authorityId: 'invented_authority',
            state: 'PASS',
            confidence: 1,
          },
        ],
      }),
    );
    const evidencePack = new LegalEvidencePackService().buildFromAuthorities({
      jurisdiction: 'IN',
      authorities: [
        {
          id: 'auth_1',
          title: 'Real Case',
          citation: '(2024) 1 SCC 1',
          sourceName: 'Supreme Court',
          sourceTier: 'case_law',
          summary: 'Real passage.',
        },
      ],
      matterFacts: [],
    });
    const overrides = await (
      service as unknown as {
        runSemanticVerificationBatch: (input: unknown) => Promise<unknown>;
      }
    ).runSemanticVerificationBatch({
      modelName: 'cheap-verifier',
      draft: {
        directAnswer: { text: 'Answer', confidence: 0.5 },
        issues: [
          {
            issueId: 'issue',
            heading: 'Issue',
            conclusion: 'Conclusion',
            propositions: [
              {
                claimId: 'identity_claim',
                text: 'A rule.',
                type: 'RULE',
                evidenceIds: ['EVD_AUTH_1_P1'],
                confidence: 0.5,
              },
            ],
          },
        ],
        practicalSteps: [],
        limitations: [],
        unansweredQuestions: [],
      },
      evidencePack,
      initial: {
        claimAudits: [
          {
            claimId: 'identity_claim',
            passageSupport: 'SUPPORTED',
          },
        ],
        findings: [
          {
            dimension: 'identity',
            state: 'FAIL',
            propositionId: 'identity_claim',
            authorityId: 'auth_1',
          },
        ],
      },
    });

    expect(llmCompletion.complete).toHaveBeenCalledTimes(1);
    expect(overrides).toBeUndefined();
  });

  it('falls back to deterministic verification when the semantic model fails', async () => {
    const { service } = buildService(
      {
        verificationUnavailable: false,
        substancePassed: true,
        substanceWarnings: [],
        sentenceAudit: { coverageRate: 1, entries: [], ungroundedCount: 0 },
        citation: {
          verified: true,
          citations: [],
          warnings: [],
          unverifiableCitations: [],
        },
      },
      new Error('model unavailable'),
    );
    const result = await service.verifyAndPublish({
      query: 'Is release unconditional?',
      outputMarkdown: 'Release is unconditional.',
      authorities: [
        {
          id: 'auth_1',
          title: 'Bail Factors Case',
          citation: '(2024) 1 SCC 10',
          sourceName: 'Supreme Court',
          sourceTier: 'case_law',
          summary: 'Bail depends on flight risk and witness tampering.',
        },
      ],
      isBareActQuery: false,
      countryCode: 'IN',
      modelName: 'cheap-verifier',
      structuredDraft: {
        directAnswer: { text: 'Unverified', confidence: 0.4 },
        issues: [
          {
            issueId: 'bail',
            heading: 'Bail',
            conclusion: 'Unverified',
            propositions: [
              {
                claimId: 'unconditional',
                text: 'Every accused has an absolute statutory entitlement to immediate acquittal.',
                type: 'RULE',
                evidenceIds: ['EVD_AUTH_1_P1'],
                confidence: 0.4,
              },
            ],
          },
        ],
        practicalSteps: [],
        limitations: [],
        unansweredQuestions: [],
      },
    });

    expect(result.propositions).toEqual([
      expect.objectContaining({ id: 'unconditional', supportState: 'UNSUPPORTED' }),
    ]);
    expect(result.unsupportedKeyClaims?.map((claim) => claim.claimId)).toEqual([
      'unconditional',
    ]);
  });

  it('publishes omitted UPI checklist items as deterministic coverage gaps', async () => {
    const { service } = buildService({
      verificationUnavailable: false,
      substancePassed: true,
      substanceWarnings: [],
      sentenceAudit: { coverageRate: 1, entries: [], ungroundedCount: 0 },
      citation: {
        verified: true,
        citations: [],
        warnings: [],
        unverifiableCitations: [],
        verificationGaps: [],
        safeForReliance: true,
      },
    });

    const result = await service.verifyAndPublish({
      query: 'Unauthorised UPI debit and loan-app recovery demand in India',
      outputMarkdown: 'Ask the bank to investigate the disputed debit.',
      authorities: [],
      isBareActQuery: false,
      countryCode: 'IN',
    });

    expect(
      result.findings.some(
        (finding) =>
          finding.checkId === 'checklist_unmet:rbi_integrated_ombudsman' &&
          finding.dimension === 'coverage',
      ),
    ).toBe(true);
    expect(result.verificationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'checklist_unmet',
          checklistId: 'consumer_commission',
        }),
      ]),
    );
    expect(result.safeForReliance).toBe(false);
  });

  it('blocks reliance when case law was requested but no admissible judgment was retrieved', async () => {
    const { service } = buildService({
      verificationUnavailable: false,
      substancePassed: true,
      substanceWarnings: [],
      sentenceAudit: { coverageRate: 1, entries: [], ungroundedCount: 0 },
      citation: {
        verified: true,
        citations: [],
        warnings: [],
        unverifiableCitations: [],
        verificationGaps: [],
        safeForReliance: true,
      },
    });

    const result = await service.verifyAndPublish({
      query: 'What binding cases govern this dispute?',
      outputMarkdown: 'No case proposition is asserted.',
      authorities: [],
      isBareActQuery: false,
      countryCode: 'IN',
      retrievalSignals: {
        caseLawRequested: true,
        caseLawSearchStatus: 'not_configured',
      },
    });

    expect(result.publicationState).toBe('DRAFT_NOT_VERIFIED');
    expect(result.safeForReliance).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: 'coverage:case_law:not_configured',
          severity: 'BLOCKER',
        }),
      ]),
    );
  });

  it('salvage / skipClaimExtraction returns empty propositions (no Review storm)', async () => {
    const { service } = buildService({
      verificationUnavailable: false,
      substancePassed: true,
      substanceWarnings: [],
      sentenceAudit: {
        coverageRate: 0.1,
        ungroundedCount: 8,
        entries: [
          {
            sentence: 'Aisha received an SMS about a loan she never took.',
            status: 'ungrounded',
          },
          {
            sentence: 'CRB listing appeared without consent.',
            status: 'ungrounded',
          },
        ],
      },
      citation: {
        verified: true,
        citations: [],
        warnings: [],
        unverifiableCitations: [],
      },
    });

    const result = await service.verifyAndPublish({
      query:
        'Aisha Kamau received an SMS about a loan she never took and was listed on CRB.',
      outputMarkdown: [
        '## Executive answer',
        '',
        'Research gap — verify against Kenya Law primary sources.',
        '',
        '## Issue',
        '',
        'Whether a fraudulent digital loan CRB listing is actionable.',
      ].join('\n'),
      authorities: [],
      isBareActQuery: false,
      countryCode: 'KE',
      skipClaimExtraction: true,
    });

    expect(result.propositions).toEqual([]);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: 'system:structured_plan_failed',
        }),
      ]),
    );
  });
});
