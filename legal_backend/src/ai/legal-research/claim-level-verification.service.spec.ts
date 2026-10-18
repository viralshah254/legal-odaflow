import { ClaimLevelVerificationService } from './claim-level-verification.service';
import { LegalEvidencePackService } from './legal-evidence-pack.service';
import type { LegalResearchDraft } from './legal-research-draft.types';
import { AuthorityIdentityService } from '@/ai/verification/authority-identity.service';
import { QuotationVerificationService } from '@/ai/verification/quotation-verification.service';
import { PropositionEntailmentService } from '@/ai/verification/proposition-entailment.service';
import { RelevanceVerificationService } from '@/ai/verification/relevance-verification.service';

describe('ClaimLevelVerificationService', () => {
  const packService = new LegalEvidencePackService();
  const service = new ClaimLevelVerificationService(
    new AuthorityIdentityService(),
    new QuotationVerificationService(),
    undefined,
    undefined,
    undefined,
    new RelevanceVerificationService(),
  );

  const pack = packService.buildFromAuthorities({
    jurisdiction: 'IN',
    authorities: [
      {
        id: 'case_1',
        title: 'Example Bail Case',
        citation: '(2024) 1 SCC 1',
        sourceName: 'Supreme Court of India',
        sourceTier: 'case_law',
        summary: 'Bail requires assessing flight risk, witness tampering, antecedents, and gravity of accusation.',
      },
    ],
    matterFacts: [{ factId: 'fact_1', description: 'The accused has no prior convictions.' }],
  });

  function draft(proposition: LegalResearchDraft['issues'][number]['propositions'][number]): LegalResearchDraft {
    return {
      directAnswer: { text: proposition.text, confidence: 0.7 },
      issues: [
        {
          issueId: 'issue_1',
          heading: 'Issue',
          conclusion: proposition.text,
          propositions: [proposition],
        },
      ],
      practicalSteps: [],
      limitations: [],
      unansweredQuestions: [],
    };
  }

  it('does not treat a registered evidenceId as passage support by itself', () => {
    const result = service.verify({
      draft: draft({
        claimId: 'claim_1',
        text: 'The Supreme Court requires mandatory bail whenever the applicant requests it.',
        type: 'RULE',
        evidenceIds: [pack.authorities[0].passages[0].evidenceId],
        confidence: 0.9,
      }),
      evidencePack: pack,
      jurisdiction: 'IN',
    });

    expect(result.claimAudits[0].passageSupport).not.toBe('SUPPORTED');
    expect(result.findings.some((f) => f.dimension === 'passage' && f.state !== 'PASS')).toBe(true);
  });

  it('rejects evidence that explicitly failed source-integrity admission', () => {
    const integrityPack = packService.buildFromAuthorities({
      jurisdiction: 'IN',
      authorities: [
        {
          id: 'case_bad_ocr',
          title: 'Unreadable Scan Case',
          citation: '(2024) 9 SCC 9',
          sourceName: 'Supreme Court of India',
          sourceTier: 'case_law',
          summary: 'Bail requires assessment of flight risk.',
          sourceProvenance: {
            provider: 'Court archive',
            retrievedAt: '2026-07-27T10:00:00.000Z',
            documentHash: 'sha256:scan',
            completeness: 'COMPLETE',
            extractionMethod: 'OCR',
            authoritativeStatus: 'OFFICIAL',
            ocr: { used: true, confidence: 0.4 },
          },
        },
      ],
    });
    const evidenceId = integrityPack.authorities[0].passages[0].evidenceId;
    const result = service.verify({
      draft: draft({
        claimId: 'claim_bad_ocr',
        text: 'Bail requires assessment of flight risk.',
        type: 'RULE',
        evidenceIds: [evidenceId],
        confidence: 0.9,
      }),
      evidencePack: integrityPack,
      jurisdiction: 'IN',
    });

    expect(result.claimAudits[0]).toMatchObject({
      passageSupport: 'UNSUPPORTED',
      action: 'REMOVE',
    });
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: 'identity:claim_bad_ocr:source-integrity',
          state: 'FAIL',
        }),
      ]),
    );
  });

  it('fails APPLICATION claims without factIds and basedOnClaimIds', () => {
    const result = service.verify({
      draft: draft({
        claimId: 'claim_app',
        text: 'Therefore the applicant should be granted bail.',
        type: 'APPLICATION',
        evidenceIds: [],
        confidence: 0.8,
      }),
      evidencePack: pack,
      jurisdiction: 'IN',
    });

    expect(result.claimAudits[0].passageSupport).toBe('UNSUPPORTED');
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dimension: 'application', state: 'FAIL', severity: 'BLOCKER' }),
      ]),
    );
  });

  it('uses HIGH not BLOCKER for SUPPORTING passage failures', () => {
    const result = service.verify({
      draft: draft({
        claimId: 'claim_support',
        text: 'The Supreme Court requires mandatory bail whenever the applicant requests it.',
        type: 'RULE',
        evidenceIds: [pack.authorities[0].passages[0].evidenceId],
        confidence: 0.9,
        materiality: 'SUPPORTING',
      }),
      evidencePack: pack,
      jurisdiction: 'IN',
    });

    const passageFail = result.findings.find((f) => f.dimension === 'passage' && f.state === 'FAIL');
    expect(passageFail?.severity).toBe('HIGH');
    expect(result.publicationState).not.toBe('DRAFT_NOT_VERIFIED');
  });

  it('fails altered quotations that do not match the linked passage', () => {
    const result = service.verify({
      draft: draft({
        claimId: 'claim_quote',
        text: 'The case says "bail is mandatory in all cases without discretion".',
        type: 'HOLDING',
        evidenceIds: [pack.authorities[0].passages[0].evidenceId],
        confidence: 0.8,
      }),
      evidencePack: pack,
      jurisdiction: 'IN',
    });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dimension: 'quotation', state: 'FAIL', severity: 'BLOCKER' }),
      ]),
    );
  });

  it('aggregates unsupported claims and current-law metadata into result-level notices', () => {
    const evidenceId = pack.authorities[0].passages[0].evidenceId;
    const multiClaimDraft = draft({
      claimId: 'claim_1',
      text: 'Every accused receives release as an unconditional statutory entitlement.',
      type: 'RULE',
      evidenceIds: [evidenceId],
      confidence: 0.9,
    });
    multiClaimDraft.issues[0].propositions.push({
      claimId: 'claim_2',
      text: 'Judges are prohibited from considering prosecutorial objections.',
      type: 'HOLDING',
      evidenceIds: [evidenceId],
      confidence: 0.9,
    });

    const result = service.verify({
      draft: multiClaimDraft,
      evidencePack: pack,
      jurisdiction: 'IN',
    });

    expect(result.limitations).toHaveLength(1);
    expect(result.limitations[0].message).toContain('2 material proposition(s)');
    expect(result.unsupportedKeyClaims.map((claim) => claim.claimId)).toEqual([
      'claim_1',
      'claim_2',
    ]);
    expect(result.advisories).toEqual([
      expect.objectContaining({
        code: 'CURRENT_LAW_METADATA_UNAVAILABLE',
        claimIds: ['claim_1', 'claim_2'],
      }),
    ]);
  });

  it('never lets a semantic override replace a deterministic contradiction', () => {
    const contradictoryPack = packService.buildFromAuthorities({
      jurisdiction: 'IN',
      authorities: [
        {
          id: 'case_contradiction',
          title: 'Discretion Case',
          citation: '(2024) 2 SCC 1',
          sourceName: 'Supreme Court of India',
          sourceTier: 'case_law',
          summary: 'Bail is not mandatory; the court retains discretion in every case.',
        },
      ],
      matterFacts: [],
    });
    const evidenceId = contradictoryPack.authorities[0].passages[0].evidenceId;
    const semanticAwareService = new ClaimLevelVerificationService(
      new AuthorityIdentityService(),
      new QuotationVerificationService(),
      new PropositionEntailmentService(),
    );
    const result = semanticAwareService.verify({
      draft: draft({
        claimId: 'contradicted_claim',
        text: 'Bail is mandatory and the court has no discretion.',
        type: 'RULE',
        evidenceIds: [evidenceId],
        confidence: 0.9,
      }),
      evidencePack: contradictoryPack,
      jurisdiction: 'IN',
      semanticOverrides: {
        passageByClaimId: {
          contradicted_claim: {
            supportState: 'SUPPORTED',
            evidenceIds: [evidenceId],
            confidence: 1,
          },
        },
      },
    });

    expect(result.claimAudits[0].passageSupport).toBe('CONTRADICTED');
  });

  it('rejects off-point PMLA authority for a consumer UPI dispute', () => {
    const offPointPack = packService.buildFromAuthorities({
      jurisdiction: 'IN',
      authorities: [
        {
          id: 'pmla',
          title: 'Prevention of Money Laundering Act, 2002 Section 11',
          citation: 'PMLA s.11',
          sourceName: 'India Code',
          sourceTier: 'primary',
          fullText: 'The Adjudicating Authority shall have power to regulate its own procedure.',
          actName: 'Prevention of Money Laundering Act',
          actYear: 2002,
          section: '11',
          heading: 'Power regarding summons and discovery',
          practiceAreas: ['criminal', 'compliance'],
        },
      ],
      matterFacts: [],
    });
    const result = service.verify({
      draft: draft({
        claimId: 'upi_off_point',
        text: 'The bank must reverse an unauthorised UPI debit under PMLA section 11.',
        type: 'RULE',
        evidenceIds: [offPointPack.statutes[0].evidenceId],
        confidence: 0.9,
      }),
      evidencePack: offPointPack,
      jurisdiction: 'IN',
      query: 'consumer complaint about unauthorised UPI debit by bank',
      legalDomain: 'consumer',
    });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dimension: 'relevance', state: 'FAIL', severity: 'BLOCKER' }),
      ]),
    );
    expect(result.claimAudits[0].action).toBe('REMOVE');
  });
});
