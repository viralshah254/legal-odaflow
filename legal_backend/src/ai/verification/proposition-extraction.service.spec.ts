import { PropositionExtractionService } from './proposition-extraction.service';
import { CitationResolutionService } from './citation-resolution.service';
import { AuthorityIdentityService } from './authority-identity.service';
import { LegalEvidencePackService } from '@/ai/legal-research/legal-evidence-pack.service';

describe('PropositionExtractionService', () => {
  const packService = new LegalEvidencePackService();
  const service = new PropositionExtractionService(
    new CitationResolutionService(new AuthorityIdentityService()),
  );

  const pack = packService.buildFromAuthorities({
    jurisdiction: 'IN',
    authorities: [
      {
        id: 'bns-101',
        title: 'BNS Section 101',
        citation: 'BNS s.101',
        sourceTier: 'primary',
        sourceName: 'India Code',
        summary:
          'Whoever commits murder shall be punished with death or imprisonment for life, and shall also be liable to fine.',
      },
    ],
    matterFacts: [
      { factId: 'fact_1', description: 'Mr A stood up from the balcony and fired a gun.' },
    ],
  });

  it('caps material propositions and marks connective sentences as supporting or drops them', () => {
    const sentences = Array.from({ length: 40 }, (_, i) => {
      if (i % 4 === 0) {
        return `Under BNS s.101 murder requires an intention to cause death in scenario ${i}.`;
      }
      if (i % 4 === 1) {
        return `Therefore on these facts Mr A stood up from the balcony and the applicant may face liability ${i}.`;
      }
      if (i % 4 === 2) {
        return `This memo is not legal advice and remains subject to lawyer review ${i}.`;
      }
      return `However the limitation is that further evidence may be required before charging ${i}.`;
    }).join(' ');

    const props = service.extract(sentences, pack);
    expect(props.length).toBeLessThanOrEqual(30);
    expect(props.filter((p) => p.materiality === 'MATERIAL').length).toBeLessThanOrEqual(20);
    expect(props.every((p) => !/not legal advice/i.test(p.text))).toBe(true);
  });

  it('marks RULE sentences with evidence as MATERIAL', () => {
    const props = service.extract(
      'Under BNS s.101 whoever commits murder shall be punished with death or imprisonment for life.',
      pack,
    );
    expect(props.some((p) => p.materiality === 'MATERIAL')).toBe(true);
  });
});
