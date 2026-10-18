/**
 * Golden Neha/Rohan divorce petition regression — Family Court form, HMA §13, party labels.
 */

import { getSkeletonForKind } from '../structural-references/india-reference-skeletons';
import { DraftKindPlaybookService } from '../playbooks/draft-kind-playbook.service';
import { CaseRecordExtractionService } from '../platform/case-record-extraction.service';
import { DraftCaseBriefService } from '../draft-case-brief.service';
import { DraftPlaybookRegistryService } from '../platform/draft-playbook-registry.service';
import { DraftAccuracyOrchestratorService } from './draft-accuracy-orchestrator.service';
import { PartyEntityValidatorService } from './party-entity-validator.service';
import { KnownFactPlaceholderValidatorService } from './known-fact-placeholder-validator.service';
import { FactFidelityAuditorService } from './fact-fidelity-auditor.service';
import { StatuteSectionValidatorService } from './statute-section-validator.service';
import { JurisdictionValidatorService } from './jurisdiction-validator.service';
import { PleadingCompletenessValidatorService } from './pleading-completeness-validator.service';
import { LimitationCauseOfActionValidatorService } from './limitation-cause-of-action-validator.service';
import { AdverseMaterialValidatorService } from './adverse-material-validator.service';
import { ReliefTestValidatorService } from './relief-test-validator.service';
import { CourtLanguageValidatorService } from './court-language-validator.service';
import { ValuationCourtFeeValidatorService } from './valuation-court-fee-validator.service';
import { AnnexureEvidenceValidatorService } from './annexure-evidence-validator.service';
import { CitationPropositionValidatorService } from './citation-proposition-validator.service';
import { LiabilityConsentExpertValidatorsService } from './liability-consent-expert-validators.service';
import { ResearchMemoQualityValidatorService } from './research-memo-quality.validator';
import { normalizeIndiaDraftStatutes } from '@/ai/india-draft/india-draft-statute-normalizer';
import { NEHA_ROHAN_INTAKE } from './neha-rohan-intake.fixture';
import { DIVORCE_PETITION_HMA_GOLDEN } from './divorce-petition-hma-golden.fixture';
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

describe('Divorce petition HMA golden (Neha/Rohan)', () => {
  const playbooks = new DraftKindPlaybookService();
  const extraction = new CaseRecordExtractionService(
    new DraftCaseBriefService(),
    new DraftPlaybookRegistryService(playbooks),
  );
  const orchestrator = buildOrchestrator();

  it('resolves india_divorce_petition_s13 family playbook (not generic_filing)', () => {
    const pb = playbooks.resolve('india_divorce_petition_s13');
    expect(pb.kind).toBe('india_divorce_petition_s13');
    expect(pb.archetype).toBe('family_matrimonial');
    expect(pb.partyLabel).toBe('Petitioner');
    expect(pb.proceduralVehicles).toContain('HMA §13');
  });

  it('aliases india_divorce_petition_s13 to HMA structural skeleton', () => {
    const skeleton = getSkeletonForKind('india_divorce_petition_s13');
    expect(skeleton).not.toBeNull();
    expect(skeleton?.kind).toBe('india_divorce_petition_hma');
    expect(skeleton?.petitionerDesignator).toBe('Petitioner');
    expect(skeleton?.respondentDesignator).toBe('Respondent');
  });

  it('golden petition passes orchestrator — Family Court caption, Petitioner/Respondent, HMA §13', () => {
    const cr = confirmRecord(
      extraction.extract({
        caseDetails: NEHA_ROHAN_INTAKE,
        documentKind: 'india_divorce_petition_s13',
        clientName: 'Neha Mehta',
        opposingParty: 'Rohan Mehta',
        courtName: 'Family Court, New Delhi',
      }),
    );

    const result = orchestrator.evaluate({
      caseRecord: cr,
      draftText: DIVORCE_PETITION_HMA_GOLDEN,
      documentKind: 'india_divorce_petition_s13',
      caseDetails: NEHA_ROHAN_INTAKE,
      requiredSections: playbooks.resolve('india_divorce_petition_s13').requiredSections,
    });

    if (!result.passed) {
      // eslint-disable-next-line no-console
      console.log(
        'orchestrator blockers:',
        result.findings.filter((f) => f.severity === 'blocker').map((f) => f.code + ': ' + f.message),
      );
    }
    expect(result.passed).toBe(true);
    expect(result.findings.filter((f) => f.severity === 'blocker')).toHaveLength(0);
  });

  it('golden petition has correct form markers and respondent in VERSUS block', () => {
    const text = DIVORCE_PETITION_HMA_GOLDEN;
    expect(text).toMatch(/IN THE FAMILY COURT AT/i);
    expect(text).toMatch(/PETITION NO\./i);
    expect(text).toMatch(/Section 13 of the Hindu Marriage Act/i);
    expect(text).toMatch(/PETITIONER/i);
    expect(text).toMatch(/RESPONDENT/i);
    expect(text).toMatch(/VERSUS[\s\S]*ROHAN MEHTA/i);
    expect(text).not.toMatch(/CIVIL SUIT NO\./i);
    expect(text).not.toMatch(/\bPlaintiff\b/i);
    expect(text).not.toMatch(/\bDefendant\b/i);
    expect(text).not.toMatch(/BNS\s*§?\s*144/i);
    expect(text).not.toMatch(/Bharatiya Nyaya Sanhita.*144/i);
  });

  it('flags civil-suit caption on divorce kind via relief validator', () => {
    const wrong = `IN THE COURT OF [BLANK]\nCIVIL SUIT NO. 123 OF 2026\nSUIT FOR DIVORCE\nPlaintiff: Neha Mehta\nDefendant: Rohan Mehta\nPRAYER: decree of divorce.`;
    const validator = new ReliefTestValidatorService();
    const result = validator.evaluate({
      draftText: wrong,
      documentKind: 'india_divorce_petition_s13',
    });
    expect(result.passed).toBe(false);
    expect(result.findings.some((f) => f.code === 'WRONG_PROCEEDING_FORM')).toBe(true);
  });

  it('normalizes BNS §144 maintenance cite in divorce prayer to HMA §24/§25', () => {
    const wrong =
      'The Petitioner prays for maintenance under Section 144 of the Bharatiya Nyaya Sanhita, 2023 for herself.';
    const result = normalizeIndiaDraftStatutes(wrong, {
      kind: 'india_divorce_petition_s13',
      caseDetails: NEHA_ROHAN_INTAKE,
    });
    expect(result.text).toMatch(/Hindu Marriage Act, 1955/i);
    expect(result.text).not.toMatch(/Bharatiya Nyaya Sanhita.*144/i);
    expect(result.corrections.length).toBeGreaterThan(0);
  });
});
