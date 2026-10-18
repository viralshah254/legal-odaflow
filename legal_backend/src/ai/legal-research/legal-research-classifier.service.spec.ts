import {
  LegalResearchClassifierService,
  type LegalDomain,
} from './legal-research-classifier.service';
import { MatterIntelligenceService } from '@/ai/matter-intelligence/matter-intelligence.service';

describe('LegalResearchClassifierService', () => {
  const matterIntelligence = {
    classify: jest.fn(),
  } as unknown as MatterIntelligenceService;
  const service = new LegalResearchClassifierService(matterIntelligence);

  describe('domain detection', () => {
    const cases: Array<{ query: string; domain: LegalDomain }> = [
      { query: 'cheque bounce under section 138 NI Act, what are the defences', domain: 'CRIMINAL' },
      { query: 'corporate insolvency resolution under IBC before NCLT', domain: 'INSOLVENCY' },
      { query: 'GST assessment order appeal before the tribunal', domain: 'TAX' },
      { query: 'divorce and maintenance under Hindu Marriage Act', domain: 'FAMILY' },
      { query: 'trademark infringement and passing off remedies', domain: 'INTELLECTUAL_PROPERTY' },
      { query: 'breach of contract and claim for damages for breach', domain: 'CONTRACT' },
      { query: 'writ petition under article 226 for fundamental right', domain: 'CONSTITUTIONAL' },
      { query: 'wrongful dismissal and severance for a workman', domain: 'EMPLOYMENT' },
      {
        query: 'Wrongful Termination, Workplace Harassment and Unpaid Incentives in Bengaluru',
        domain: 'EMPLOYMENT',
      },
      { query: 'employee claims unpaid commission after termination', domain: 'EMPLOYMENT' },
      { query: 'employment notice period and Shops and Establishments Act remedies', domain: 'EMPLOYMENT' },
      { query: 'arbitration clause and section 34 challenge to arbitral award', domain: 'ARBITRATION' },
      { query: 'tenancy eviction and possession of property', domain: 'PROPERTY' },
      { query: 'consumer complaint for deficiency in service', domain: 'CONSUMER' },
      {
        query:
          'ASCE delay analysis versus SCL Delay and Disruption Protocol for FIDIC extension of time and concurrent delay',
        domain: 'CONSTRUCTION_DELAY',
      },
    ];

    it.each(cases)('classifies "$query" as $domain', ({ query, domain }) => {
      const result = service.classify({ query, countryCode: 'IN' });
      expect(result.legalDomain).toBe(domain);
    });
  });

  describe('jurisdiction resolution', () => {
    it('uses provided country code', () => {
      const result = service.classify({ query: 'contract dispute', countryCode: 'US' });
      expect(result.jurisdiction).toBe('US');
      expect(result.jurisdictionAssumed).toBe(false);
    });

    it('marks jurisdiction unresolved instead of silently defaulting to India', () => {
      const result = service.classify({ query: 'contract dispute' });
      expect(result.jurisdiction).toBe('UNKNOWN');
      expect(result.jurisdictionAssumed).toBe(true);
    });
  });

  describe('current-law check requirement', () => {
    it('recognises a similar-case outcome request as case-law research', () => {
      const result = service.classify({
        query:
          'What are similar cases in Indian law where arbitration clauses in partnership agreements were disputed, and what were the key outcomes?',
        countryCode: 'IN',
      });

      expect(result.issueType).toBe('CASE_LAW_RESEARCH');
      expect(result.legalDomain).toBe('ARBITRATION');
    });

    it('requires current-law check for case-law research', () => {
      const result = service.classify({
        query: 'leading cases and precedent on s.139 NI Act presumption',
        countryCode: 'IN',
      });
      expect(result.requiresCurrentLawCheck).toBe(true);
    });

    it('requires current-law check when asking for latest position', () => {
      const result = service.classify({
        query: 'what is the current law on anticipatory bail after the 2024 amendment',
        countryCode: 'IN',
      });
      expect(result.requiresCurrentLawCheck).toBe(true);
    });
  });

  describe('research intent resolution', () => {
    it.each([
      ['compare the facts and holdings in two director disqualification cases', 'CASE_COMPARISON'],
      ['interpretation and scope of section 11 of the Arbitration Act', 'STATUTORY_INTERPRETATION'],
      ['what is the procedure and forum for filing this appeal', 'PROCEDURE'],
      ['what is the current law and latest position on this issue', 'CURRENT_LAW'],
      ['find adverse authorities and cases against this proposition', 'ADVERSE_AUTHORITY'],
      ['provide the neutral citation for Kesavananda Bharati', 'CITATION_LOOKUP'],
    ] as const)('recognises %s', (query, intent) => {
      const result = service.classify({ query, countryCode: 'IN' });

      expect(result.researchIntent.primary).toBe(intent);
      expect(result.researchIntent.detected).toContain(intent);
      expect(result.researchIntent.fallbackUsed).toBe(false);
      expect(result.taskProfile.scores[result.taskProfile.kind]).toBeGreaterThan(0);
    });

    it('does not impose comparison policy on the reported plural case survey', () => {
      const result = service.classify({
        query:
          'What are similar cases in Indian law where arbitration clauses in partnership agreements were enforced or disputed, and what were the key outcomes?',
        countryCode: 'IN',
      });

      expect(result.taskProfile.kind).toBe('CASE_SURVEY');
      expect(result.researchIntent.primary).not.toBe('CASE_COMPARISON');
    });

    it('reports deterministic ties instead of silently choosing by signal order', () => {
      const result = service.classify({
        query: 'What is the current law and procedure for filing an appeal?',
        countryCode: 'IN',
      });

      expect(result.researchIntent.tied).toBe(true);
      expect(result.researchIntent.confidence).toBe('LOW');
      expect(result.researchIntent.detected).toEqual(
        expect.arrayContaining(['CURRENT_LAW', 'PROCEDURE']),
      );
    });

    it('does not treat a tenant premature-notice remedies query as PROCEDURE', () => {
      const result = service.classify({
        query:
          'What remedies, if any, are available to a tenant in India when a landlord issues a notice to vacate before the contractual notice period expires, without a stated valid reason, and the tenant has no alternative accommodation?',
        countryCode: 'IN',
      });
      expect(result.legalDomain).toBe('PROPERTY');
      expect(result.researchIntent.primary).not.toBe('PROCEDURE');
    });

    it('uses a low-confidence scored fallback for unrecognised research wording', () => {
      const result = service.classify({
        query: 'advise about contractual rights',
        countryCode: 'IN',
      });

      expect(result.researchIntent).toEqual(
        expect.objectContaining({
          primary: 'GENERAL_RESEARCH',
          confidence: 'LOW',
          fallbackUsed: true,
          scores: { GENERAL_RESEARCH: 1 },
        }),
      );
    });
  });

  describe('urgency + posture', () => {
    it('detects urgency and bail posture', () => {
      const result = service.classify({
        query: 'urgent: anticipatory bail needed, hearing tomorrow',
        countryCode: 'IN',
      });
      expect(result.urgency).toBe('HIGH');
      expect(result.proceduralPosture).toBe('bail');
    });
  });
});
