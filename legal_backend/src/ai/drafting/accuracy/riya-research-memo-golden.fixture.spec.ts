/**
 * Golden Riya research memo regression — shape, CPA, insurance, adverse authority.
 */

import { CaseRecordExtractionService } from '../platform/case-record-extraction.service';
import { DraftCaseBriefService } from '../draft-case-brief.service';
import { DraftPlaybookRegistryService } from '../platform/draft-playbook-registry.service';
import { DraftKindPlaybookService } from '../playbooks/draft-kind-playbook.service';
import { DraftAccuracyOrchestratorService } from './draft-accuracy-orchestrator.service';
import { PartyEntityValidatorService } from './party-entity-validator.service';
import { KnownFactPlaceholderValidatorService } from './known-fact-placeholder-validator.service';
import { FactFidelityAuditorService } from './fact-fidelity-auditor.service';
import { StatuteSectionValidatorService } from './statute-section-validator.service';
import { JurisdictionValidatorService } from './jurisdiction-validator.service';
import {
  PleadingCompletenessValidatorService,
  splitDraftSections,
  wordCount,
} from './pleading-completeness-validator.service';
import { LimitationCauseOfActionValidatorService } from './limitation-cause-of-action-validator.service';
import { AdverseMaterialValidatorService } from './adverse-material-validator.service';
import { ReliefTestValidatorService } from './relief-test-validator.service';
import { CourtLanguageValidatorService } from './court-language-validator.service';
import { ValuationCourtFeeValidatorService } from './valuation-court-fee-validator.service';
import { AnnexureEvidenceValidatorService } from './annexure-evidence-validator.service';
import { CitationPropositionValidatorService } from './citation-proposition-validator.service';
import { LiabilityConsentExpertValidatorsService } from './liability-consent-expert-validators.service';
import { ResearchMemoQualityValidatorService } from './research-memo-quality.validator';
import { RIYA_INTAKE } from './riya-intake.fixture';
import { RIYA_GOLDEN_RESEARCH_MEMO } from './riya-research-memo-golden.fixture';
import type { CaseRecord } from '../contracts/case-record';

function buildOrchestrator(): DraftAccuracyOrchestratorService {
  return new DraftAccuracyOrchestratorService(
    new PartyEntityValidatorService(),
    new KnownFactPlaceholderValidatorService(),
    new FactFidelityAuditorService(),
    new StatuteSectionValidatorService(),
    new JurisdictionValidatorService(),
    new PleadingCompletenessValidatorService(),
    new LimitationCauseOfActionValidatorService(),
    new AdverseMaterialValidatorService(),
    new ReliefTestValidatorService(),
    new CourtLanguageValidatorService(),
    new ValuationCourtFeeValidatorService(),
    new AnnexureEvidenceValidatorService(),
    new CitationPropositionValidatorService(),
    new LiabilityConsentExpertValidatorsService(),
    new ResearchMemoQualityValidatorService(),
  );
}

function confirmRecord(cr: CaseRecord): CaseRecord {
  return {
    ...cr,
    metadata: { ...cr.metadata, status: 'confirmed', confirmedAt: new Date().toISOString() },
  };
}

describe('Riya golden research memo', () => {
  const extraction = new CaseRecordExtractionService(
    new DraftCaseBriefService(),
    new DraftPlaybookRegistryService(new DraftKindPlaybookService()),
  );
  const orchestrator = buildOrchestrator();

  it('golden memo passes orchestrator with required sections and no §2(1)(d)', () => {
    const cr = confirmRecord(
      extraction.extract({
        caseDetails: RIYA_INTAKE,
        documentKind: 'india_consumer_research_memo',
        clientName: 'Riya Desai',
        opposingParty:
          'Sunrise Multispeciality Hospital; Dr. Mahesh Trivedi; Dr. Kavita Rao; SecureCare Health Insurance Ltd.',
        courtName: 'District Consumer Disputes Redressal Commission, Ahmedabad',
      }),
    );

    const result = orchestrator.evaluate({
      caseRecord: cr,
      draftText: RIYA_GOLDEN_RESEARCH_MEMO,
      documentKind: 'india_consumer_research_memo',
      caseDetails: RIYA_INTAKE,
      mode: 'balanced',
      requiredSections: ['SHORT ANSWER', 'ISSUES', 'FACTS', 'ANALYSIS', 'AUTHORITIES', 'NEXT STEPS'],
      consumerMatterSignals: true,
    });

    const blockerCodes = result.findings
      .filter((f) => f.severity === 'blocker')
      .map((f) => f.code);

    expect(blockerCodes).not.toContain('WRONG_SECTION');
    expect(blockerCodes).not.toContain('RELIEF_TEST_NOT_PLEADED');
    expect(blockerCodes).not.toContain('PRAYER_EXCEEDS_LEGAL_TEST');
    expect(RIYA_GOLDEN_RESEARCH_MEMO).not.toMatch(/§?\s*2\s*\(\s*1\s*\)\s*\(\s*d\s*\)/i);

    const quality = new ResearchMemoQualityValidatorService();
    const qualityResult = quality.evaluate({
      draftText: RIYA_GOLDEN_RESEARCH_MEMO,
      documentKind: 'india_consumer_research_memo',
      caseRecord: cr,
      caseDetails: RIYA_INTAKE,
      consumerMatterSignals: true,
    });
    expect(qualityResult.passed).toBe(true);

    const pleading = new PleadingCompletenessValidatorService();
    const pleadingResult = pleading.evaluate({
      draftText: RIYA_GOLDEN_RESEARCH_MEMO,
      documentKind: 'india_consumer_research_memo',
      requiredSections: ['SHORT ANSWER', 'ISSUES', 'FACTS', 'ANALYSIS', 'AUTHORITIES', 'NEXT STEPS'],
    });
    expect(pleadingResult.passed).toBe(true);

    const shortAnswer = splitDraftSections(RIYA_GOLDEN_RESEARCH_MEMO).find((s) =>
      /short\s*answer/i.test(s.title),
    );
    expect(shortAnswer).toBeTruthy();
    expect(wordCount(shortAnswer!.body)).toBeLessThan(400);
    expect(/spring meadows/i.test(RIYA_GOLDEN_RESEARCH_MEMO)).toBe(true);
  });

  it('blocks vicarious insurer liability when no repudiation in intake', () => {
    const cr = confirmRecord(
      extraction.extract({
        caseDetails: RIYA_INTAKE,
        documentKind: 'india_consumer_research_memo',
      }),
    );
    const badMemo = `
## SHORT ANSWER
SecureCare is vicariously liable for hospital negligence.

## ISSUES
1. Insurer liability?

## FACTS
Surgery on 11 March 2025.

## ANALYSIS
Direct and vicarious insurer liability applies.

## AUTHORITIES
Spring Meadows Hospital v. Harjol Ahluwalia (1998) 4 SCC 39.

## NEXT STEPS
Sue insurer.
`;
    const liability = new LiabilityConsentExpertValidatorsService();
    const r = liability.evaluate({
      caseRecord: cr,
      draftText: badMemo,
      caseDetails: RIYA_INTAKE,
      documentKind: 'india_consumer_research_memo',
      consumerMatterSignals: true,
    });
    expect(r.passed).toBe(false);
    expect(r.findings.some((f) => f.code === 'INVENTED_INSURER_DENIAL')).toBe(true);
  });

  it('interim relief strategy in NEXT STEPS does not trigger prayer blockers', () => {
    const cr = confirmRecord(
      extraction.extract({
        caseDetails: RIYA_INTAKE,
        documentKind: 'india_consumer_research_memo',
      }),
    );
    const memoWithInterimStrategy = `
${RIYA_GOLDEN_RESEARCH_MEMO.replace(
  /## NEXT STEPS[\s\S]*$/,
  `## NEXT STEPS

Seek interim directions for complete operative notes, anaesthesia charts, consent forms, and imaging. File consumer complaint under CPA 2019 §35 before the District Commission, Ahmedabad.`,
)}
`;
    const result = orchestrator.evaluate({
      caseRecord: cr,
      draftText: memoWithInterimStrategy,
      documentKind: 'india_consumer_research_memo',
      caseDetails: RIYA_INTAKE,
      mode: 'balanced',
      requiredSections: ['SHORT ANSWER', 'ISSUES', 'FACTS', 'ANALYSIS', 'AUTHORITIES', 'NEXT STEPS'],
      consumerMatterSignals: true,
    });
    const blockerCodes = result.findings
      .filter((f) => f.severity === 'blocker')
      .map((f) => f.code);
    expect(blockerCodes).not.toContain('RELIEF_TEST_NOT_PLEADED');
    expect(blockerCodes).not.toContain('PRAYER_EXCEEDS_LEGAL_TEST');
  });

  it('qualified consent language passes DISPUTED_FACT_STATED_AS_ADMITTED', () => {
    const cr = confirmRecord(
      extraction.extract({
        caseDetails: RIYA_INTAKE,
        documentKind: 'india_consumer_research_memo',
      }),
    );
    const liability = new LiabilityConsentExpertValidatorsService();
    const r = liability.evaluate({
      caseRecord: cr,
      draftText: RIYA_GOLDEN_RESEARCH_MEMO,
      caseDetails: RIYA_INTAKE,
      documentKind: 'india_consumer_research_memo',
      consumerMatterSignals: true,
    });
    expect(r.findings.some((f) => f.code === 'DISPUTED_FACT_STATED_AS_ADMITTED')).toBe(false);
  });
});
