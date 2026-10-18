import type { JurisdictionForm } from '@prisma/client';
import { PlaybookResolverService } from '@/ai/draft-intent/playbook-resolver.service';
import { extractMatterFacts } from '@/ai/draft-intent/matter-fact-extractor';
import {
  documentKindToDraftKind,
  resolveCuratedDraftKindForInjection,
} from '@/ai/draft-intent/draft-intent.helpers';
import { DraftProceduralGateService } from '@/ai/drafting/draft-procedural-gate.service';
import { DraftProceduralRouterService } from '@/ai/drafting/draft-procedural-router.service';
import { DraftKindPlaybookService } from '@/ai/drafting/playbooks/draft-kind-playbook.service';
import { getSkeletonForKind } from '@/ai/drafting/structural-references/india-reference-skeletons';
import { LegalFormsSearchService } from '@/legal-forms/legal-forms-search.service';
import { buildCommercialRecoveryFactLock } from '@/ai/draft-intent/commercial-recovery-calculator';
import { evaluateCommercialRecoveryDraft } from '@/ai/drafting/accuracy/commercial-recovery-validator';
import type { CaseRecord } from '@/ai/drafting/contracts/case-record';
import {
  APEX_ZENITH_COMMERCIAL_RECOVERY_GOLDEN,
  APEX_ZENITH_COMMERCIAL_RECOVERY_INTAKE,
  APEX_ZENITH_FORBIDDEN_OUTPUT_PATTERNS,
  APEX_ZENITH_INSUFFICIENT_FORUM_INTAKE,
  APEX_ZENITH_LEAKY_BAD_DRAFT,
  APEX_ZENITH_ORDINARY_RECOVERY_INTAKE,
  APEX_ZENITH_REQUIRED_OUTPUT_PATTERNS,
  APEX_ZENITH_UNSAFE_FILING_DRAFT,
} from '@/ai/drafting/accuracy/apex-zenith-commercial-recovery.fixture';

const SUMMARY_SUIT_KIND = 'india_suit_recovery_cpc_37';

function form(
  id: string,
  formName: string,
  practiceArea: string,
  authority: string,
): JurisdictionForm {
  return {
    id,
    formName,
    formNumber: null,
    authority,
    description: formName,
    practiceArea,
    category: practiceArea,
    countryCode: 'IN',
    jurisdiction: 'GJ',
    sourceUrl: 'https://example.test/form',
    feeInfo: null,
    lastUpdated: null,
    isSystem: true,
    tenantId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  } as JurisdictionForm;
}

describe('Apex Packaging v Zenith Retail — deterministic commercial recovery golden', () => {
  it('contains every filing-grade marker and none of the known leakage', () => {
    for (const required of APEX_ZENITH_REQUIRED_OUTPUT_PATTERNS) {
      expect(APEX_ZENITH_COMMERCIAL_RECOVERY_GOLDEN).toMatch(required);
    }
    for (const forbidden of APEX_ZENITH_FORBIDDEN_OUTPUT_PATTERNS) {
      expect(APEX_ZENITH_COMMERCIAL_RECOVERY_GOLDEN).not.toMatch(forbidden);
    }
  });

  it('detects family, criminal, SEBI, and set-off leakage in the adversarial draft', () => {
    const detected = APEX_ZENITH_FORBIDDEN_OUTPUT_PATTERNS.filter((pattern) =>
      pattern.test(APEX_ZENITH_LEAKY_BAD_DRAFT),
    );

    expect(detected.length).toBeGreaterThanOrEqual(4);
    expect(APEX_ZENITH_LEAKY_BAD_DRAFT).toMatch(/family court/i);
    expect(APEX_ZENITH_LEAKY_BAD_DRAFT).toMatch(/FIR/i);
    expect(APEX_ZENITH_LEAKY_BAD_DRAFT).toMatch(/SEBI/i);
    expect(APEX_ZENITH_LEAKY_BAD_DRAFT).toMatch(/set-off/i);
  });

  it('routes the written commercial debt to the specific Order XXXVII filing set', () => {
    const result = new PlaybookResolverService().resolve({
      query: APEX_ZENITH_COMMERCIAL_RECOVERY_INTAKE,
      extracted: extractMatterFacts(APEX_ZENITH_COMMERCIAL_RECOVERY_INTAKE),
    });

    expect(result).toBeDefined();
    expect(result?.playbookId).toMatch(/commercial.*recovery|summary.*suit/i);
    // Delivery dates, exact forum designation, pecuniary allocation, and fee
    // remain unknown; the route may be identified but must stay provisional.
    expect(result?.provisional).toBe(true);
    expect(result?.bundle[0]).toEqual(
      expect.objectContaining({
        kind: SUMMARY_SUIT_KIND,
        bundleRole: 'primary',
      }),
    );
    expect(result?.bundle.map((item) => item.kind)).not.toEqual(
      expect.arrayContaining([
        'india_court_marriage_petition',
        'india_criminal_revision',
        'india_sebi_delisting_petition',
        'india_set_off_counterclaim_civil',
      ]),
    );
  });

  it('maps and injects the specific summary-suit kind without falling back to a generic plaint', () => {
    expect(documentKindToDraftKind(SUMMARY_SUIT_KIND, 'IN')).toBe(SUMMARY_SUIT_KIND);
    expect(resolveCuratedDraftKindForInjection(SUMMARY_SUIT_KIND, 'IN')).toBe(
      SUMMARY_SUIT_KIND,
    );
  });

  it('resolves a commercial summary-suit playbook and structural skeleton', () => {
    const playbook = new DraftKindPlaybookService().resolve(SUMMARY_SUIT_KIND);
    const skeleton = getSkeletonForKind(SUMMARY_SUIT_KIND);

    expect(playbook.kind).toBe(SUMMARY_SUIT_KIND);
    expect(playbook.archetype).toMatch(/commercial|civil_plaint/i);
    expect(playbook.partyLabel).toBe('Plaintiff');
    expect(playbook.proceduralVehicles).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/CPC Order XXXVII/),
        'Commercial Courts Act §12A',
      ]),
    );
    const requiredSections = playbook.requiredSections.join(' | ');
    for (const marker of [
      /CAUSE TITLE/i,
      /LIST OF DATES/i,
      /JURISDICTION/i,
      /CAUSE OF ACTION/i,
      /LIMITATION/i,
      /VALUATION AND COURT FEE/i,
      /PRAYER/i,
      /VERIFICATION/i,
      /STATEMENT OF TRUTH/i,
      /AFFIDAVIT/i,
      /LIST OF (?:DOCUMENTS|ANNEXURES)/i,
    ]) {
      expect(requiredSections).toMatch(marker);
    }

    expect(skeleton).not.toBeNull();
    expect(skeleton?.causeTitleVehicle).toMatch(/Order XXXVII|commercial summary suit/i);
    expect(skeleton?.petitionerDesignator).toBe('Plaintiff');
    expect(skeleton?.respondentDesignator).toBe('Defendant');
    expect(skeleton?.mandatorySections.join(' ')).toMatch(/Order XXXVII/i);
    expect(skeleton?.mandatorySections.join(' ')).toMatch(/12A/i);
    expect(skeleton?.referenceText).toMatch(/statement of truth/i);
    expect(skeleton?.referenceText).not.toMatch(
      /family court|\bFIR\b|\bSEBI\b|set[- ]?off/i,
    );
  });

  it('keeps the explicit commercial route through the procedural router', () => {
    const router = new DraftProceduralRouterService(new DraftProceduralGateService());
    const result = router.route({
      kind: SUMMARY_SUIT_KIND,
      caseDetails: APEX_ZENITH_COMMERCIAL_RECOVERY_INTAKE,
      countryCode: 'IN',
      courtName: 'Competent Commercial Court at Ahmedabad',
      respectUserSelection: true,
    });

    expect(result.recommendedKind).toBe(SUMMARY_SUIT_KIND);
    expect(result.causeTitleVehicle).toMatch(/Order XXXVII|summary suit|plaint/i);
    expect(result.governingSections.map((section) => section.section).join(' ')).toMatch(
      /XXXVII|37/,
    );
    expect(result.maintainabilityNotes.join(' ')).toMatch(/commercial|written|liquidated/i);
    expect(result.proceduralWarnings.join(' ')).not.toMatch(
      /family|criminal|maintenance|SEBI|set[- ]?off/i,
    );
  });

  it('does not force Order XXXVII when the debt has no written foundation', () => {
    const result = new PlaybookResolverService().resolve({
      query: APEX_ZENITH_ORDINARY_RECOVERY_INTAKE,
      extracted: extractMatterFacts(APEX_ZENITH_ORDINARY_RECOVERY_INTAKE),
    });

    expect(result?.bundle[0]?.kind).not.toBe(SUMMARY_SUIT_KIND);
  });

  it('does not present a filing-ready summary suit when decisive forum facts are missing', () => {
    const result = new PlaybookResolverService().resolve({
      query: APEX_ZENITH_INSUFFICIENT_FORUM_INTAKE,
      extracted: extractMatterFacts(APEX_ZENITH_INSUFFICIENT_FORUM_INTAKE),
    });

    expect(
      result === undefined ||
        result.provisional ||
        result.bundle[0]?.kind !== SUMMARY_SUIT_KIND,
    ).toBe(true);
  });

  it('fails closed on the reported filing defects before export', () => {
    const lock = buildCommercialRecoveryFactLock({
      facts: APEX_ZENITH_COMMERCIAL_RECOVERY_INTAKE,
    });
    const caseRecord = {
      metadata: {
        caseRecordId: 'CR_APEX_ZENITH',
        version: 1,
        status: 'draft',
        extractedAt: new Date().toISOString(),
        sourceHash: 'apex-zenith',
        playbookId: 'commercial-summary-recovery',
        playbookVersion: '1',
      },
      jurisdiction: { countryCode: 'IN', stateOrRegion: 'Gujarat' },
      parties: [],
      facts: [],
      chronology: [],
      evidence: [],
      statutes: [],
      suggestedStatutes: [],
      contradictions: [],
      missingFields: [],
      matterData: {},
      factLocks: [
        {
          id: 'FACT_LOCK_COMMERCIAL_RECOVERY',
          kind: lock.kind,
          version: 1,
          status: 'blocked',
          sourceHash: 'apex-zenith',
          payload: lock,
          blockingIssues: lock.blockingIssues,
        },
      ],
    } satisfies CaseRecord;

    expect(lock.invoices.map((invoice) => invoice.invoiceNumber)).toEqual([
      'APS/2451',
      'APS/2518',
      'APS/2594',
    ]);
    expect(lock.payments[0]?.amount).toBe(750_000);

    const audit = evaluateCommercialRecoveryDraft({
      caseRecord,
      caseDetails: APEX_ZENITH_COMMERCIAL_RECOVERY_INTAKE,
      documentKind: SUMMARY_SUIT_KIND,
      draftText: APEX_ZENITH_UNSAFE_FILING_DRAFT,
    });
    const codes = audit.findings.map((finding) => finding.code);
    expect(audit.passed).toBe(false);
    expect(codes).toEqual(
      expect.arrayContaining([
        'COMMERCIAL_INVOICE_ID_MISMATCH',
        'COMMERCIAL_CALCULATION_INPUTS_UNCONFIRMED',
        'MALFORMED_MONETARY_PLACEHOLDER',
        'COMMERCIAL_UNSUPPORTED_SERIOUS_ALLEGATION',
        'COMMERCIAL_ELECTRONIC_RECORD_FOUNDATION_MISSING',
      ]),
    );

    const procedure = new DraftProceduralGateService().check({
      kind: SUMMARY_SUIT_KIND,
      caseDetails: APEX_ZENITH_UNSAFE_FILING_DRAFT,
      countryCode: 'IN',
      courtName: 'District Court, Ahmedabad',
    });
    expect(procedure.proceduralWarnings.join(' ')).toMatch(
      /wrong_interim_relief_provision|section_12a_contradiction|unsupported_attachment/i,
    );
  });
});

describe('Apex Packaging v Zenith Retail — deterministic form search', () => {
  it('fails closed against cross-forum and opposing-posture vector hits', async () => {
    const commercial = form(
      'commercial-summary-suit',
      'Commercial Summary Suit under Order XXXVII CPC',
      'corporate_commercial',
      'Commercial Court, Ahmedabad',
    );
    const family = form(
      'court-marriage',
      'Court Marriage Petition',
      'family_matrimonial',
      'Family Court, Ahmedabad',
    );
    const criminal = form(
      'criminal-revision',
      'Criminal Revision Petition',
      'criminal',
      'Sessions Court, Ahmedabad',
    );
    const sebi = form(
      'sebi-delisting',
      'SEBI Delisting Petition',
      'securities',
      'Securities Appellate Tribunal',
    );
    const setOff = form(
      'set-off',
      'Set Off Counterclaim Civil',
      'corporate_commercial',
      'Commercial Court, Ahmedabad',
    );
    const candidates = [commercial, family, criminal, sebi, setOff];

    const legalForms = {
      findByIds: jest.fn().mockResolvedValue(candidates),
      searchByTokens: jest.fn().mockResolvedValue(candidates),
    };
    const embeddings = {
      searchByVector: jest.fn().mockResolvedValue(
        candidates.map((candidate, index) => ({
          sourceId: candidate.id,
          score: 0.96 - index * 0.01,
        })),
      ),
    };
    const service = new LegalFormsSearchService(legalForms as never, embeddings as never);

    const hits = await service.searchByIntent(APEX_ZENITH_COMMERCIAL_RECOVERY_INTAKE, {
      countryCode: 'IN',
      jurisdiction: 'GJ',
      practiceArea: 'corporate_commercial',
      excludePracticeAreas: ['family_matrimonial', 'criminal', 'securities'],
      limit: 10,
    });

    expect(hits.map((hit) => hit.form.id)).toEqual(['commercial-summary-suit']);
    expect(hits.map((hit) => hit.form.formName).join(' ')).not.toMatch(
      /marriage|criminal|SEBI|set[- ]?off|counterclaim/i,
    );
  });
});
