import { BailSectionResolverService } from './bail-section-resolver.service';

describe('BailSectionResolverService', () => {
  const resolver = new BailSectionResolverService();

  describe('Sessions Court / HC filing → §483', () => {
    it('resolves to §483 when Sessions Court is mentioned', () => {
      const result = resolver.resolve({
        documentKind: 'india_regular_bail_bnss_480',
        courtName: 'Sessions Court, Ahmedabad',
        rawFacts: 'Accused arrested under BNS §317. Bail rejected by Sessions Court.',
      });
      expect(result.section).toBe('483');
      expect(result.forum).toBe('sessions');
    });

    it('resolves to §483 when High Court is mentioned', () => {
      const result = resolver.resolve({
        documentKind: 'india_regular_bail_bnss_480',
        courtName: 'High Court of Gujarat',
        rawFacts: 'Successive bail application before the Hon. High Court.',
      });
      expect(result.section).toBe('483');
      expect(result.forum).toBe('high_court');
    });

    it('resolves to §483 when prior rejection is in facts', () => {
      const result = resolver.resolve({
        documentKind: 'india_regular_bail_bnss_480',
        courtName: '',
        rawFacts: 'Bail was dismissed by the learned Sessions Judge. Filing fresh bail before HC.',
      });
      expect(result.section).toBe('483');
    });

    it('resolves to §483 by default for regular bail (ambiguous = Sessions path)', () => {
      const result = resolver.resolve({
        documentKind: 'india_regular_bail_bnss_480',
        rawFacts: 'Accused arrested under BNS §317. Seeking bail.',
      });
      expect(result.section).toBe('483');
    });
  });

  describe('Magistrate Court → §480', () => {
    it('resolves to §480 when JMFC is mentioned', () => {
      const result = resolver.resolve({
        documentKind: 'india_regular_bail_bnss_480',
        courtName: 'JMFC, Surat',
        rawFacts: 'Bail application before Judicial Magistrate First Class.',
      });
      expect(result.section).toBe('480');
      expect(result.forum).toBe('magistrate');
    });

    it('resolves to §480 when CJM is mentioned', () => {
      const result = resolver.resolve({
        documentKind: 'india_regular_bail_bnss_480',
        courtName: 'CJM Court, Ahmedabad',
        rawFacts: 'Accused produced before Chief Judicial Magistrate.',
      });
      expect(result.section).toBe('480');
    });
  });

  describe('Anticipatory bail → §482', () => {
    it('resolves to §482 for anticipatory bail kind', () => {
      const result = resolver.resolve({
        documentKind: 'india_anticipatory_bail_bnss_482',
        rawFacts: 'Applicant apprehends arrest in a non-bailable offence.',
      });
      expect(result.section).toBe('482');
    });

    it('resolves to §482 when "not yet arrested" appears in facts', () => {
      const result = resolver.resolve({
        documentKind: 'india_regular_bail_bnss_480',
        rawFacts: 'Applicant has not yet been arrested but fears arrest under BNS §420.',
      });
      expect(result.section).toBe('482');
    });
  });

  describe('Non-bail document kinds', () => {
    it('returns §480 placeholder for non-bail kinds (irrelevant)', () => {
      const result = resolver.resolve({
        documentKind: 'india_legal_notice',
        rawFacts: 'Legal notice for breach of contract.',
      });
      expect(result.reasoning).toContain('Not a bail kind');
    });
  });

  describe('Geeta scenario (BNS §317 — Sessions rejected)', () => {
    it('correctly resolves Geeta bail to §483', () => {
      const result = resolver.resolve({
        documentKind: 'india_regular_bail_bnss_480',
        courtName: 'High Court of Gujarat',
        rawFacts:
          'Accused Geeta arrested in FIR under BNS §317(2) and §317(4). Sessions Court rejected bail citing ₹51 lakh transactions. Filing successive bail before High Court.',
      });
      expect(result.section).toBe('483');
      expect(result.forum).toBe('high_court');
      expect(result.crpcEquivalent).toBe('CrPC §439');
    });
  });
});
