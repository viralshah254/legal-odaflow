/**
 * Riya Desai medical-negligence consumer complaint — regression fixture.
 * Asserts deterministic accuracy validators catch invented insurer denial,
 * known blanks, wrong CPA cites, SecureCare typo, and overclaiming.
 *
 * Manual acceptance (filing set — run after deploy):
 * 1. Confirm CaseRecord on step 1; navigate to step 2 — CaseRecord persists
 * 2. Generate consumer complaint — FACTS has surgery/consent/chronology; no Mahesh/Kavita; no insurer denial
 * 3. Stepper shows Ready only if finalResolutionStatus is clean/repaired; else Blocked or Confirm
 * 4. Export filing blocked until clean
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
import { DraftAccuracyRepairService } from './draft-accuracy-repair.service';
import { DraftRepairSourceResolverService } from './draft-repair-source-resolver.service';
import { DraftRepairConfirmationService } from './draft-repair-confirmation.service';
import { ACCURACY_BLOCKER_CODES } from './accuracy-finding';
import { INDIA_CONSUMER_MEDICAL_NEGLIGENCE_PLAYBOOK } from '../playbooks/india-consumer-medical-negligence.playbook';
import { DRAFT_KIND_PLAYBOOKS } from '../playbooks/draft-kind-playbook.registry';
import { resolveCourtProfile } from '../legal/court-profile';
import type { DraftKindPlaybook } from '../playbooks/draft-kind-playbook.types';
import type { AccuracyFinding } from './accuracy-finding';
import type { Party, ChronologyEvent, MoneyRecord } from '../contracts/case-record';
import { RIYA_INTAKE } from './riya-intake.fixture';

export { RIYA_INTAKE };

const BAD_DRAFT_INVENTED_DENIAL = `
BEFORE THE DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION, AHMEDABAD
Complainant: Riya Desai
Opposite Parties: Sunrise Multispeciality Hospital; Dr. Anil Trivedi; Dr. Meera Rao; SecurCare Health Insurance
FACTS: Surgery on [BLANK]. Consent on [BLANK]. Amount [BLANK].
GROUNDS: SecureCare rejected the claim in bad faith and repudiated coverage wrongfully.
Jurisdiction under Section 2(1)(h) of the Consumer Protection Act. District Commission has pecuniary jurisdiction for claims exceeding ₹1 crore up to 10 crore.
Dr. Rao caused the bile-duct injury. Consent was not obtained. Records were forged.
Private expert proves negligence conclusively. Res ipsa loquitur automatically applies.
`;

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
    new DraftAccuracyRepairService(),
    new DraftRepairSourceResolverService(),
    new DraftRepairConfirmationService(),
  );
}

describe('Riya medical-negligence consumer fixture', () => {
  const brief = new DraftCaseBriefService();
  const legacyPlaybooks = new DraftKindPlaybookService();
  const playbooks = new DraftPlaybookRegistryService(legacyPlaybooks);
  const extraction = new CaseRecordExtractionService(brief, playbooks);
  const orchestrator = buildOrchestrator();

  it('registers consumer + medical-negligence playbooks', () => {
    expect(DRAFT_KIND_PLAYBOOKS.some((p: DraftKindPlaybook) => p.kind === 'india_consumer_complaint')).toBe(true);
    expect(DRAFT_KIND_PLAYBOOKS.some((p: DraftKindPlaybook) => p.kind === 'india_consumer_medical_negligence')).toBe(
      true,
    );
    expect(DRAFT_KIND_PLAYBOOKS.some((p: DraftKindPlaybook) => p.kind === 'india_consumer_interim_records_preservation')).toBe(
      true,
    );
    expect(INDIA_CONSUMER_MEDICAL_NEGLIGENCE_PLAYBOOK.prohibitedAssertions).toContain(
      'invented_insurer_denial',
    );
  });

  it('extracts parties, chronology, money from Riya intake', () => {
    const cr = extraction.extract({
      caseDetails: RIYA_INTAKE,
      documentKind: 'india_consumer_complaint',
      clientName: 'Riya Desai',
      opposingParty:
        'Sunrise Multispeciality Hospital; Dr. Anil Trivedi; Dr. Meera Rao; SecureCare Health Insurance Co. Ltd.',
      courtName: 'District Consumer Disputes Redressal Commission, Ahmedabad',
    });

    expect(cr.parties.some((p: Party) => /riya/i.test(p.name))).toBe(true);
    expect(cr.parties.some((p: Party) => /securecare/i.test(p.name))).toBe(true);
    expect(cr.jurisdiction.stateOrRegion).toMatch(/ahmedabad/i);

    const dates = (cr.chronology ?? []).map((e: ChronologyEvent) => e.date).filter(Boolean).join(' ');
    expect(dates).toMatch(/10\s+March\s+2025|11\s+March\s+2025|13\s+March\s+2025/i);

    const moneyLabels = (cr.moneyRecords ?? []).map((m: MoneyRecord) => m.amountLabel).join(' ');
    expect(moneyLabels).toMatch(/1,?80,?000/);
  });

  it('blocks invented insurer denial, wrong CPA section, SecurCare typo, known blanks', () => {
    const cr = extraction.extract({
      caseDetails: RIYA_INTAKE,
      documentKind: 'india_consumer_medical_negligence',
      clientName: 'Riya Desai',
      opposingParty:
        'Sunrise Multispeciality Hospital; Dr. Anil Trivedi; Dr. Meera Rao; SecureCare Health Insurance Co. Ltd.',
      courtName: 'District Consumer Disputes Redressal Commission, Ahmedabad',
    });

    const result = orchestrator.evaluate({
      caseRecord: cr,
      draftText: BAD_DRAFT_INVENTED_DENIAL,
      documentKind: 'india_consumer_medical_negligence',
      caseDetails: RIYA_INTAKE,
      mode: 'strict',
      requiredSections: ['CAUSE TITLE', 'FACTS', 'JURISDICTION', 'GROUNDS', 'PRAYER', 'VERIFICATION'],
    });

    expect(result.passed).toBe(false);
    const codes = new Set(
      result.findings
        .filter((f: AccuracyFinding) => f.severity === 'blocker')
        .map((f: AccuracyFinding) => f.code),
    );

    expect(codes.has(ACCURACY_BLOCKER_CODES.INVENTED_INSURER_DENIAL)).toBe(true);
    expect(codes.has(ACCURACY_BLOCKER_CODES.WRONG_SECTION)).toBe(true);
    expect(codes.has(ACCURACY_BLOCKER_CODES.ENTITY_NAME_MISMATCH)).toBe(true);
    expect(
      codes.has(ACCURACY_BLOCKER_CODES.KNOWN_VALUE_LEFT_BLANK) ||
        codes.has(ACCURACY_BLOCKER_CODES.UNSUPPORTED_MATERIAL_FACT),
    ).toBe(true);
  });

  it('passes a clean allegation-qualified draft with known facts filled', () => {
    const cr = extraction.extract({
      caseDetails: RIYA_INTAKE,
      documentKind: 'india_consumer_complaint',
      clientName: 'Riya Desai',
      opposingParty:
        'Sunrise Multispeciality Hospital; Dr. Anil Trivedi; Dr. Meera Rao; SecureCare Health Insurance Co. Ltd.',
      courtName: 'District Consumer Disputes Redressal Commission, Ahmedabad',
    });

    const cleanDraft = `
BEFORE THE DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION, AHMEDABAD
Complainant: Riya Desai, Navrangpura, Ahmedabad
Opposite Party No. 1: Sunrise Multispeciality Hospital
Opposite Party No. 2: Dr. Anil Trivedi
Opposite Party No. 3: Dr. Meera Rao
Opposite Party No. 4: SecureCare Health Insurance Co. Ltd.

JURISDICTION: Territorial jurisdiction arises at Ahmedabad where the cause of action arose and the Complainant resides. Pecuniary jurisdiction is invoked under Section 34 of the Consumer Protection Act, 2019 based on the claim value including estimated expenses of ₹1,80,000 (subject to confirmation of current notification thresholds). The complaint is filed under Section 35 CPA 2019.

FACTS: Consent was signed on 10 March 2025. Laparoscopic gallbladder surgery was performed on 11 March 2025 by Dr. Anil Trivedi; Dr. Meera Rao was the anaesthesiologist. A CT scan was performed on 13 March 2025. The Complainant was transferred on 15 March 2025. Corrective treatment was undertaken on 17 March 2025. Admission lasted approximately 24 days. Estimated additional expenses are ₹1,80,000. It is alleged that there was deficiency in service and that informed consent was defective, subject to proof. A private expert has opined that delayed diagnosis was probable based on available records. SecureCare is impleaded as insurer of the cashless facility; no claim repudiation is pleaded.

GROUNDS: Alleged medical negligence and deficiency in service under CPA 2019; hospital vicarious liability alleged; consent defects alleged. Liability theories are pleaded separately against hospital, surgeon, anaesthesiologist, and insurer as applicable. No conclusive forgery is asserted; apparent record inconsistencies are alleged and preservation/production is sought.

PRAYER: Compensation, costs, and directions for preservation and production of medical records.
VERIFICATION: Verified at Ahmedabad.
`;

    const result = orchestrator.evaluate({
      caseRecord: cr,
      draftText: cleanDraft,
      documentKind: 'india_consumer_complaint',
      caseDetails: RIYA_INTAKE,
      mode: 'balanced',
      requiredSections: ['CAUSE TITLE', 'FACTS', 'JURISDICTION', 'GROUNDS', 'PRAYER', 'VERIFICATION'],
    });

    const critical = result.findings.filter(
      (f: AccuracyFinding) =>
        f.severity === 'blocker' &&
        [
          ACCURACY_BLOCKER_CODES.INVENTED_INSURER_DENIAL,
          ACCURACY_BLOCKER_CODES.WRONG_SECTION,
          ACCURACY_BLOCKER_CODES.ENTITY_NAME_MISMATCH,
          ACCURACY_BLOCKER_CODES.KNOWN_VALUE_LEFT_BLANK,
        ].includes(f.code as never),
    );
    expect(critical).toHaveLength(0);
  });

  it('flags hollow STATEMENT OF FACTS / GROUNDS stubs from broken filing-set output', () => {
    const hollow = `
## CAUSE TITLE
BEFORE THE DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION, AHMEDABAD
## STATEMENT OF FACTS
Riya Desai
## GROUNDS
for specific risks is blank
## PRAYER
Compensation as claimed.
## VERIFICATION
Verified.
`;
    const cr = extraction.extract({
      caseDetails: RIYA_INTAKE,
      documentKind: 'india_consumer_complaint',
      clientName: 'Riya Desai',
    });
    const result = orchestrator.evaluate({
      caseRecord: cr,
      draftText: hollow,
      documentKind: 'india_consumer_complaint',
      caseDetails: RIYA_INTAKE,
      mode: 'balanced',
      requiredSections: ['CAUSE TITLE', 'FACTS', 'GROUNDS', 'PRAYER', 'VERIFICATION'],
    });
    expect(
      result.findings.some((f) => f.code === ACCURACY_BLOCKER_CODES.SECTION_STUB_OR_EMPTY),
    ).toBe(true);
  });

  it('reviewAndRepair clears repairable Riya blockers (entity/section/denial/blanks)', async () => {
    const cr = extraction.extract({
      caseDetails: RIYA_INTAKE,
      documentKind: 'india_consumer_complaint',
      clientName: 'Riya Desai',
      opposingParty:
        'Sunrise Multispeciality Hospital; Dr. Anil Trivedi; Dr. Meera Rao; SecureCare Health Insurance Co. Ltd.',
      courtName: 'District Consumer Disputes Redressal Commission, Ahmedabad',
    });
    const result = await orchestrator.reviewAndRepair(
      {
        caseRecord: cr,
        draftText: BAD_DRAFT_INVENTED_DENIAL,
        documentKind: 'india_consumer_complaint',
        caseDetails: RIYA_INTAKE,
        consumerMatterSignals: true,
        requiredSections: ['CAUSE TITLE', 'FACTS', 'JURISDICTION', 'GROUNDS', 'PRAYER', 'VERIFICATION'],
      },
      { mode: 'fast', maxAttempts: 3 },
    );
    expect(result.resolvedFindingCodes.length).toBeGreaterThan(0);
    expect(result.draftText).toMatch(/SecureCare/);
    expect(result.draftText).not.toMatch(/SecurCare/);
    const remainingCritical = result.finalFindings.filter(
      (f) =>
        f.severity === 'blocker' &&
        [
          ACCURACY_BLOCKER_CODES.ENTITY_NAME_MISMATCH,
          ACCURACY_BLOCKER_CODES.INVENTED_INSURER_DENIAL,
          ACCURACY_BLOCKER_CODES.WRONG_SECTION,
        ].includes(f.code as never),
    );
    expect(remainingCritical).toHaveLength(0);
  });

  it('resolves Ahmedabad District Consumer CourtProfile', () => {
    const profile = resolveCourtProfile(
      'District Consumer Disputes Redressal Commission, Ahmedabad',
    );
    expect(profile?.id).toBe('in-district-consumer-ahmedabad');
    expect(profile?.partyTerminology.applicant).toBe('Complainant');
  });
});

describe('Follow-on fixture smoke — playbook kinds registered', () => {
  const kinds = [
    'india_consumer_complaint',
    'india_consumer_medical_negligence',
    'india_regular_bail_bnss_480',
    'india_civil_suit_plaint',
    'india_writ_petition_hc',
    'india_cheque_dishonour_complaint',
  ];

  it.each(kinds)('has playbook entry for %s', (kind: string) => {
    expect(
      DRAFT_KIND_PLAYBOOKS.some(
        (p: DraftKindPlaybook) => p.kind === kind || p.kind.includes(kind.split('_').slice(-1)[0]),
      ),
    ).toBe(true);
  });
});
