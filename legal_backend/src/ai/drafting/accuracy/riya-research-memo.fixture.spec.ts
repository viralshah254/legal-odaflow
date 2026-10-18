/**
 * Riya research-memo register + fidelity escape regression.
 * Ensures pleading-shaped research memos are blocked and CPA/party escapes are closed.
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
import { ACCURACY_BLOCKER_CODES } from './accuracy-finding';
import { INDIA_DRAFT_SYSTEM_PROMPTS } from '@/ai/india-draft/india-draft-prompts';
import { INDIA_RICH_PROMPT_OVERRIDES } from '../templates/india-tier1';
import { RIYA_INTAKE } from './riya-intake.fixture';
import type { AccuracyFinding } from './accuracy-finding';

const BAD_PLEADING_SHAPED_MEMO = `
# CAUSE TITLE
IN THE DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION, AHMEDABAD
BETWEEN:
RIYA DESAI
*Petitioner*
AND
1. SUNRISE MULTISPECIALITY HOSPITAL PVT. LTD.
2. DR. MAHESH TRIVEDI
3. DR. KAVITA RAO
4. SECURCARE HEALTH INSURANCE LTD.
*Respondents*

STATEMENT OF FACTS
1. [BLANK].
2. [BLANK].
3. Surgery on [BLANK]. Consent on [BLANK]. Amount [BLANK].

JURISDICTION
The District Commission has pecuniary jurisdiction where the claim exceeds ₹1 crore but does not exceed ₹10 crores under Section 2(1)(d) of the Act. Under Section 2(1)(c) territorial jurisdiction arises. Deficiency under Section 2(18).

GROUNDS
SecureCare rejected the claim in bad faith and repudiated coverage wrongfully.

PRAYER
Award compensation of ₹,,

VERIFICATION
I, Riya Desai, the Petitioner...
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
  );
}

describe('Riya research memo register & fidelity', () => {
  const brief = new DraftCaseBriefService();
  const playbooks = new DraftPlaybookRegistryService(new DraftKindPlaybookService());
  const extraction = new CaseRecordExtractionService(brief, playbooks);
  const orchestrator = buildOrchestrator();

  it('research memo prompts forbid court pleading form', () => {
    const memo = INDIA_DRAFT_SYSTEM_PROMPTS.india_legal_research_memo;
    expect(memo).toMatch(/NOT a court pleading/i);
    expect(memo).toMatch(/FORBIDDEN FORM|Do NOT write CAUSE TITLE/i);
    expect(memo).toMatch(/Complainant and Opposite Party/i);
    expect(memo).toMatch(/insurer denial/i);

    const tier1 = INDIA_RICH_PROMPT_OVERRIDES.india_legal_research_memo;
    expect(tier1).toBeTruthy();
    expect(tier1).toMatch(/FORBIDDEN/i);
    expect(tier1).toMatch(/SHORT ANSWER/i);
  });

  it('blocks pleading-shaped research memo on consumer facts', () => {
    const cr = extraction.extract({
      caseDetails: RIYA_INTAKE,
      documentKind: 'india_legal_research_memo',
      clientName: 'Riya Desai',
      opposingParty:
        'Sunrise Multispeciality Hospital; Dr. Anil Trivedi; Dr. Meera Rao; SecureCare Health Insurance Co. Ltd.',
      courtName: 'District Consumer Disputes Redressal Commission, Ahmedabad',
    });

    const result = orchestrator.evaluate({
      caseRecord: cr,
      draftText: BAD_PLEADING_SHAPED_MEMO,
      documentKind: 'india_legal_research_memo',
      caseDetails: RIYA_INTAKE,
      mode: 'balanced',
      requiredSections: ['SHORT ANSWER', 'ISSUES', 'FACTS', 'ANALYSIS', 'AUTHORITIES', 'NEXT STEPS'],
      consumerMatterSignals: true,
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
    expect(codes.has(ACCURACY_BLOCKER_CODES.WRONG_PARTY_TERMINOLOGY)).toBe(true);
    expect(
      codes.has(ACCURACY_BLOCKER_CODES.KNOWN_VALUE_LEFT_BLANK) ||
        codes.has(ACCURACY_BLOCKER_CODES.PECUNIARY_BASIS_UNSUPPORTED),
    ).toBe(true);
  });

  it('statute validator rejects §2(16) in jurisdiction context and §34 for deficiency', () => {
    const statute = new StatuteSectionValidatorService();
    const r1 = statute.evaluate({
      draftText:
        'District Commission pecuniary jurisdiction arises under CPA §2(16) because the claim exceeds ₹5 lakh.',
      documentKind: 'india_consumer_research_memo',
    });
    expect(r1.passed).toBe(false);

    const r2 = statute.evaluate({
      draftText:
        'Deficiency in service is defined under Section 34 of the Consumer Protection Act, 2019.',
      documentKind: 'india_consumer_research_memo',
    });
    expect(r2.passed).toBe(false);
    expect(r2.findings.some((f) => f.code === ACCURACY_BLOCKER_CODES.WRONG_SECTION)).toBe(true);
  });

  it('statute validator rejects §2(1)(d) and §2(18) without allowlist escape', () => {
    const statute = new StatuteSectionValidatorService();
    const r = statute.evaluate({
      draftText:
        'Pecuniary jurisdiction under Section 2(1)(d) of the Consumer Protection Act, 2019. Deficiency under Section 2(18).',
      documentKind: 'india_legal_research_memo',
    });
    expect(r.passed).toBe(false);
    expect(r.findings.some((f) => f.code === ACCURACY_BLOCKER_CODES.WRONG_SECTION)).toBe(true);
  });

  it('extracts medical consent and bile-leak facts from Riya intake', () => {
    const cr = extraction.extract({
      caseDetails: RIYA_INTAKE,
      documentKind: 'india_consumer_research_memo',
      clientName: 'Riya Desai',
      opposingParty:
        'Sunrise Multispeciality Hospital; Dr. Mahesh Trivedi; Dr. Kavita Rao; SecureCare Health Insurance Ltd.',
      courtName: 'District Consumer Disputes Redressal Commission, Ahmedabad',
    });

    const propositions = cr.facts.map((f) => f.proposition).join('\n');
    expect(propositions).toMatch(/specific risks.*blank/i);
    expect(propositions).toMatch(/bile/i);
    expect(cr.chronology.some((e) => /consent|surgery|ultrasound|ct|specialist/i.test(e.label))).toBe(
      true,
    );
    expect(cr.contradictions.length).toBeGreaterThan(0);
    expect(cr.evidence.some((e) => /consent|expert|medical board/i.test(e.type + e.description))).toBe(
      true,
    );
  });

  it('flags hollow SHORT ANSWER in correctly shaped memo', () => {
    const pleading = new PleadingCompletenessValidatorService();
    const hollowMemo = `
## SHORT ANSWER

## ISSUES

## FACTS
1. On 4 March 2025 ultrasound recorded gallstones.
2. On 10 March 2025 consent form signed with blank risk section.
3. On 11 March 2025 laparoscopic surgery converted to open surgery.

## ANALYSIS
Maintainability appears supported before District CDRC Ahmedabad.

## AUTHORITIES
Spring Meadows Hospital v. Harjol Ahluwalia (1998) 4 SCC 39.

## NEXT STEPS
File consumer complaint and interim records application.
`;
    const r = pleading.evaluate({
      draftText: hollowMemo,
      documentKind: 'india_consumer_research_memo',
      requiredSections: ['SHORT ANSWER', 'ISSUES', 'FACTS', 'ANALYSIS', 'AUTHORITIES', 'NEXT STEPS'],
    });
    expect(r.passed).toBe(false);
    expect(
      r.findings.some(
        (f) =>
          f.code === ACCURACY_BLOCKER_CODES.SECTION_STUB_OR_EMPTY &&
          /SHORT ANSWER|ISSUES/i.test(f.sectionHint ?? f.message),
      ),
    ).toBe(true);
  });
});
