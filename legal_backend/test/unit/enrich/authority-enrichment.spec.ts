import { SimilarCasesService, isStatuteAuthority } from '@/ai/legal-research/similar-cases.service';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import { AuthorityRetrievalPlannerService } from '@/ai/drafting/platform/authority-retrieval-planner.service';
import { AuthorityVerificationGateValidator } from '@/ai/drafting/platform/validators/authority-verification-gate.validator';
import { PropositionEntailmentService } from '@/ai/verification/proposition-entailment.service';
import { AuthorityEnrichVerifier } from '@/ai/unified-drafting/enrich/authority-enrich-verifier';
import { resolveCuratedEnrichBank } from '@/ai/unified-drafting/enrich/curated-enrich-banks';
import {
  AUTHORITY_GATE_FAIL_LABEL,
  evaluateAuthorityEnrichGate,
  type VerifiedAuthorityRecord,
} from '@/ai/drafting/contracts/authority-verification';

const MEERA_FACTS = `
Plaintiff: Meera Shah
Defendant No. 1: Arjun Patel
Defendant No. 2: Nisha Patel
Agreement to sell dated 12 January 2024 for Plot No. 14, Satellite, Ahmedabad, Gujarat.
Plaintiff paid earnest money and has always been ready and willing to perform.
Defendants failed to execute the registered sale deed and threatened to alienate the property.
Suit for specific performance, permanent injunction, and alternatively compensation.
`;

const MEERA_DRAFT = `
IN THE COURT OF THE CIVIL JUDGE, AHMEDABAD
Civil Suit for Specific Performance

The plaintiff is ready and willing to perform her part of the agreement to sell.
The plaintiff seeks a decree of specific performance of the agreement dated 12 January 2024.
A temporary injunction may restrain alienation or alteration of the disputed property while the suit is pending.
The cause of action arose at Ahmedabad within the territorial jurisdiction of this Hon'ble Court.
The suit is within limitation.
The plaintiff prays for costs of the suit.
`;

const UNRELATED_STATUTES: Array<{
  id: string;
  title: string;
  citation: string;
  summary: string;
}> = [
  {
    id: 'noise_dpdp_38',
    title: 'DPDP Act s.38',
    citation: 'DPDP Act s.38',
    summary:
      '(1) The provisions of this Act shall be in addition to and not in derogation of any other law for the time being in force.',
  },
  {
    id: 'noise_const_app3',
    title: 'Constitution Appendix III',
    citation: 'Constitution s.appendix-III',
    summary: 'APPENDIX III.—Declaration under article 370(3) of the Constitution.',
  },
  {
    id: 'noise_bda_1',
    title: 'Biological Diversity Act s.1',
    citation: 'Biological Diversity Act s.1',
    summary: '1. Short title, extent and commencement.',
  },
  {
    id: 'noise_copyright_12',
    title: 'Copyright Act s.12',
    citation: 'Copyright Act s.12',
    summary: '12. Powers and procedure of Appellate Board.',
  },
  {
    id: 'noise_pc_29',
    title: 'PC Act s.29',
    citation: 'PC Act s.29',
    summary: '29. Amendment of the Ordinance 38 of 1944.',
  },
  {
    id: 'noise_crpc_438',
    title: 'CrPC s.438',
    citation: 'CrPC s.438',
    summary: 'Direction for grant of bail to person apprehending arrest.',
  },
];

function makeVerifier(): AuthorityEnrichVerifier {
  return new AuthorityEnrichVerifier(
    new PropositionEntailmentService(),
    new AuthorityRetrievalPlannerService(),
  );
}

describe('Authority enrichment — Meera Shah specific-performance regression', () => {
  const planner = new AuthorityRetrievalPlannerService();
  const similar = new SimilarCasesService();

  describe('AuthorityRetrievalPlanner', () => {
    it('builds civil specific-performance plan for india_civil_plaint + SP facts', () => {
      const plan = planner.buildPlan({
        documentKind: 'india_civil_plaint',
        jurisdiction: 'IN-GJ',
        rawFacts: MEERA_FACTS,
      });
      expect(plan.jurisdiction).toBe('IN-GJ');
      expect(plan.legalIssues).toEqual(
        expect.arrayContaining([
          'specific_performance',
          'readiness_and_willingness',
          'temporary_injunction',
        ]),
      );
      expect(plan.permittedStatutes).toEqual(
        expect.arrayContaining(['CPC', 'SRA', 'TPA', 'Specific Relief Act']),
      );
      expect(plan.excludedDomains).toEqual(
        expect.arrayContaining([
          'data_protection',
          'criminal_procedure',
          'biodiversity',
          'copyright',
          'corruption',
          'constitutional_amendment',
        ]),
      );
    });
  });

  describe('SimilarCasesService harden', () => {
    it('detects statutes and does not promote them as cases', () => {
      const statutes: RetrievedAuthority[] = UNRELATED_STATUTES.map((s) => ({
        id: s.id,
        title: s.title,
        citation: s.citation,
        summary: s.summary,
        sourceName: 'Bare Act',
        sourceTier: 'primary' as const,
        authorityType: 'STATUTE',
      }));

      for (const s of statutes) {
        expect(isStatuteAuthority(s)).toBe(true);
      }

      const ranked = similar.extractAndRank(statutes, 'civil plaint specific performance', 'IN', 8);
      expect(ranked).toHaveLength(0);
    });

    it('does not fall back to citation-length > 5 for non-cases', () => {
      const noise: RetrievedAuthority[] = [
        {
          id: 'x',
          title: 'DPDP Act s.38',
          citation: 'DPDP Act section 38 — long enough citation string',
          summary: 'consistency with other laws',
          sourceName: 'Web',
          sourceTier: 'web',
          authorityType: 'STATUTE',
        },
      ];
      expect(similar.extractAndRank(noise, 'property suit Ahmedabad', 'IN', 8)).toHaveLength(0);
    });
  });

  describe('verifyRetrievedCandidate exclusions', () => {
    const verifier = makeVerifier();
    const plan = planner.buildPlan({
      documentKind: 'india_civil_plaint',
      jurisdiction: 'IN-GJ',
      rawFacts: MEERA_FACTS,
    });
    const prop = {
      proposition:
        'A temporary injunction may restrain alienation of disputed property while the suit is pending.',
      issue: 'temporary_injunction',
      documentKind: 'india_civil_plaint',
      preferredAuthorityType: 'case' as const,
    };

    it.each(UNRELATED_STATUTES)('excludes $title', (s) => {
      const record = verifier.verifyRetrievedCandidate(
        {
          id: s.id,
          title: s.title,
          citation: s.citation,
          summary: s.summary,
          court: 'Statute',
          year: null,
          sourceUrl: null,
          areas: [],
        },
        prop,
        MEERA_DRAFT,
        plan,
        true,
      );
      expect(record.excluded).toBe(true);
      expect(record.relevanceStatus).toBe('fail');
      expect(record.currentLawStatus).not.toBe('good_law');
    });

    it('does not label unrelated statutes as good_law', () => {
      for (const s of UNRELATED_STATUTES) {
        const record = verifier.verifyRetrievedCandidate(
          {
            id: s.id,
            title: s.title,
            citation: s.citation,
            summary: s.summary,
            court: 'Court',
            year: null,
            areas: [],
          },
          prop,
          MEERA_DRAFT,
          plan,
          true,
        );
        expect(record.currentLawStatus).toBe('unknown');
      }
    });

    it('excludes Canara Bank loan-recovery trial judgment for SP plaint', () => {
      const record = verifier.verifyRetrievedCandidate(
        {
          id: 'ik-canara-bank-surender',
          title: 'Canara Bank vs Surender Kumar Rawat',
          citation: 'Canara Bank vs Surender Kumar Rawat on 20 February, 2024',
          summary:
            'EX-PARTE JUDGMENT IN SUIT FOR RECOVERY OF Rs. 2,04,783/-. Defendants approached the bank for a personal loan. Bank account statements and contractual interest. Recovery of outstanding principal.',
          court: 'District Court, Delhi',
          year: 2024,
          sourceUrl: 'https://indiankanoon.org/doc/123',
          areas: ['cause_of_action'],
        },
        {
          proposition:
            'The plaintiff seeks a decree of specific performance of the agreement to sell.',
          issue: 'specific_performance',
          documentKind: 'india_civil_plaint',
          preferredAuthorityType: 'case',
        },
        MEERA_DRAFT,
        plan,
        false,
      );
      expect(record.excluded).toBe(true);
      expect(record.relevanceStatus).toBe('fail');
      expect(record.currentLawStatus).toBe('unknown');
      expect(record.exclusionReason ?? '').toMatch(/loan-recovery|Banking|Trial-court/i);
    });

    it('includes banking_recovery in civil SP plan excluded domains', () => {
      expect(plan.excludedDomains).toContain('banking_recovery');
      expect(planner.detectExcludedDomain('suit for recovery of personal loan', plan)).toBe(
        'banking_recovery',
      );
    });
  });

  describe('curated civil bank', () => {
    it('loads Vidyanadam / readiness authorities for civil plaint SP facts', () => {
      const bank = resolveCuratedEnrichBank('india_civil_plaint', MEERA_FACTS);
      expect(bank.some((c) => /Vidyanadam/i.test(c.title))).toBe(true);
      expect(bank.some((c) => /readiness|Srinivasa/i.test(c.title + c.proposition))).toBe(true);
    });

    it('verifies curated cases against draft propositions with relevance pass', () => {
      const verifier = makeVerifier();
      const plan = planner.buildPlan({
        documentKind: 'india_civil_plaint',
        rawFacts: MEERA_FACTS,
      });
      const props = verifier.extractPropositions(MEERA_DRAFT, 'india_civil_plaint', plan);
      expect(props.length).toBeGreaterThan(0);
      expect(props.some((p) => p.issue === 'specific_performance' || /specific performance/i.test(p.proposition))).toBe(
        true,
      );

      const curated = resolveCuratedEnrichBank('india_civil_plaint', MEERA_FACTS);
      const records = verifier.verifyCurated(curated, props, MEERA_DRAFT, plan);
      const passed = records.filter((r) => !r.excluded && r.relevanceStatus === 'pass');
      expect(passed.length).toBeGreaterThanOrEqual(1);
      expect(passed.some((r) => /Vidyanadam|Srinivasa|Suraj Lamp|Dalpat/i.test(r.title))).toBe(true);
      for (const r of passed) {
        expect(r.authorityType).toBe('case');
        expect(r.currentLawStatus).toBe('good_law');
      }
    });
  });

  describe('release gate', () => {
    it('blocks when only excluded unrelated authorities exist', () => {
      const records: VerifiedAuthorityRecord[] = UNRELATED_STATUTES.map((s) => ({
        id: s.id,
        authorityType: 'statute' as const,
        citation: s.citation,
        title: s.title,
        proposition: 'n/a',
        issue: 'none',
        identityStatus: 'fail' as const,
        relevanceStatus: 'fail' as const,
        currentLawStatus: 'unknown' as const,
        citedInDraft: false,
        authorityTypeMisclassified: true,
        excluded: true,
        exclusionReason: 'Excluded domain',
      }));
      const gate = evaluateAuthorityEnrichGate(records);
      expect(gate.canExport).toBe(false);
      expect(gate.userLabel).toBe(AUTHORITY_GATE_FAIL_LABEL);
    });

    it('passes when verified cited case authorities are present', () => {
      const records: VerifiedAuthorityRecord[] = [
        {
          id: 'curated__ks_vidyanadam_v_vairavan_1997',
          authorityType: 'case',
          citation: '(1997) 3 SCC 1',
          title: 'K.S. Vidyanadam v. Vairavan',
          proposition: 'Specific performance is discretionary.',
          issue: 'specific_performance',
          identityStatus: 'pass',
          relevanceStatus: 'pass',
          currentLawStatus: 'good_law',
          citedInDraft: true,
          authorityTypeMisclassified: false,
          excluded: false,
        },
      ];
      const gate = new AuthorityVerificationGateValidator().evaluateEnrich(records);
      expect(gate.canExport).toBe(true);
      expect(gate.verifiedCount).toBe(1);
    });

    it('blocks identity fail on displayed authority', () => {
      const findings = new AuthorityVerificationGateValidator().evaluate([
        {
          id: 'bad',
          authorityType: 'case',
          citation: 'Fake Cite',
          title: 'Fake v. Case',
          proposition: 'x',
          issue: 'specific_performance',
          identityStatus: 'fail',
          relevanceStatus: 'pass',
          currentLawStatus: 'good_law',
          citedInDraft: true,
          authorityTypeMisclassified: false,
          excluded: false,
        },
      ]);
      expect(findings.some((f) => f.severity === 'blocker')).toBe(true);
    });
  });
});
