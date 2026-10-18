import { CitationResolutionService } from './citation-resolution.service';
import { AuthorityIdentityService } from './authority-identity.service';
import { LegalEvidencePackService } from '@/ai/legal-research/legal-evidence-pack.service';

describe('CitationResolutionService', () => {
  const packService = new LegalEvidencePackService();
  const service = new CitationResolutionService(new AuthorityIdentityService());

  const pack = packService.buildFromAuthorities({
    jurisdiction: 'IN',
    authorities: [
      {
        id: 'statute-in-bns-s78',
        title: 'Bharatiya Nyaya Sanhita, 2023 Section 78',
        citation: 'BNS s.78',
        sourceName: 'Bare Act Corpus',
        sourceTier: 'primary',
        summary: 'Stalking provision.',
        fullText: '78. Stalking. Whoever follows a woman and contacts, or attempts to contact such woman repeatedly...',
      },
    ],
  });

  it('resolves compact statute citations to statute evidence IDs', () => {
    const spans = service.resolveText('The complaint invokes BNS §78 for stalking.', pack);

    expect(spans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'BNS §78',
          resolved: true,
          evidenceIds: expect.arrayContaining([pack.statutes[0].evidenceId]),
        }),
      ]),
    );
  });
});
