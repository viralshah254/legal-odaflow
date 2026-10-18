import { LegalSanityCheckService } from './legal-sanity-check.service';

describe('LegalSanityCheckService', () => {
  const service = new LegalSanityCheckService();

  describe('India NI Act / BNSS forbidden patterns (block-and-repair)', () => {
    const badSnippets: Array<{ name: string; text: string }> = [
      {
        name: 's.138 described as cognizable',
        text: 'The offence under s.138 NI Act is a cognizable offence triable by the Magistrate.',
      },
      {
        name: 'police arrest without warrant',
        text: 'Once the cheque bounces, the police can arrest without warrant immediately.',
      },
      {
        name: 'BNSS s.462 recovery of fine',
        text: 'Under BNSS s.462 the court orders recovery of the fine by attachment and sale.',
      },
      {
        name: 'BNSS s.465 instalments',
        text: 'BNSS s.465 permits payment of the fine in instalments and suspension of imprisonment.',
      },
      {
        name: 'compounding under s.147 BNSS',
        text: 'The offence may be compounded under s.147 of the BNSS at any stage.',
      },
      {
        name: 'mere dishonour = guilt',
        text: 'In effect, mere dishonour of the cheque, plus notice, plus non-payment = guilt.',
      },
      {
        name: 'security cheque complete defence',
        text: 'Because it was a security cheque, this is a complete defence to s.138.',
      },
      {
        name: 'stop payment standalone defence',
        text: 'A stop payment instruction is a standalone defence and the case fails.',
      },
      {
        name: 'individual insolvency before District Court',
        text: 'Personal insolvency of the drawer lies before the District Court.',
      },
      {
        name: 'cannot avoid payment entirely',
        text: 'The drawer cannot avoid payment entirely once the cheque is dishonoured.',
      },
    ];

    it.each(badSnippets)('flags: $name', ({ text }) => {
      const result = service.check({ outputMarkdown: text, countryCode: 'IN' });
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('corrected wording passes', () => {
    const goodSnippets: string[] = [
      'The offence under s.138 NI Act is generally non-cognizable, bailable, and compoundable, and proceeds by complaint before a Magistrate.',
      'Compounding of NI Act offences is governed by s.147 of the Negotiable Instruments Act, 1881.',
      'A security cheque can still attract s.138 if a legally enforceable liability had crystallised by the date of presentation; it is not by itself a complete defence.',
      'A "stop payment" instruction can still fall within s.138; the accused must rebut the s.139 presumption.',
      'Conviction under s.138 requires proof of all statutory ingredients; the s.139 presumption is rebuttable.',
    ];

    it.each(goodSnippets)('passes: %s', (text) => {
      const result = service.check({ outputMarkdown: text, countryCode: 'IN' });
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('generic forbidden patterns', () => {
    it('flags AI-generated citation disclaimer', () => {
      const result = service.check({
        outputMarkdown: 'Note: case citations are AI-generated and may be inaccurate.',
        countryCode: 'US',
      });
      expect(result.passed).toBe(false);
    });

    it('flags guaranteed-to-win language', () => {
      const result = service.check({
        outputMarkdown: 'On these facts you are guaranteed to win the appeal.',
        countryCode: 'GB',
      });
      expect(result.passed).toBe(false);
    });

    it('passes calibrated language', () => {
      const result = service.check({
        outputMarkdown:
          'On the retrieved authorities, the stronger position is that the claim is likely to succeed, subject to the facts.',
        countryCode: 'GB',
      });
      expect(result.passed).toBe(true);
    });
  });

  describe('matrimonial eval cases', () => {
    it.each([
      {
        name: 'rejects acquittal-equals-falsity reasoning',
        text: 'His acquittal therefore proves that her matrimonial complaint was false.',
        passed: false,
      },
      {
        name: 'accepts good-faith and civil-standard nuance',
        text:
          'The acquittal does not itself establish knowing falsity. The matrimonial court should assess her good faith, corroboration, adverse material, and the cumulative effect of the conduct on the civil standard.',
        passed: true,
      },
      {
        name: 'accepts fact-sensitive HMA condonation analysis',
        text:
          'If cohabitation resumed with forgiveness and restoration, HMA s.23 condonation may require analysis; later conduct may also bear on revival, and cohabitation alone is not conclusive.',
        passed: true,
      },
    ])('$name', ({ text, passed }) => {
      expect(service.check({ outputMarkdown: text, countryCode: 'IN' }).passed).toBe(passed);
    });
  });

  describe('buildCorrectionInstructions', () => {
    it('returns empty string when no violations', () => {
      expect(service.buildCorrectionInstructions([])).toBe('');
    });

    it('enumerates violations', () => {
      const out = service.buildCorrectionInstructions(['Error A', 'Error B']);
      expect(out).toContain('Error A');
      expect(out).toContain('Error B');
      expect(out).toContain('CORRECTIONS REQUIRED');
    });
  });
});
