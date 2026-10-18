import { LegalFormsController } from '@/legal-forms/legal-forms.controller';
import { LegalFormsService } from '@/legal-forms/legal-forms.service';
import { LegalFormsSearchService } from '@/legal-forms/legal-forms-search.service';

describe('LegalFormsController intent-search', () => {
  it('returns ranked items and scores from search service', async () => {
    const form = {
      id: 'f1',
      formName: 'Maintenance Application',
      authority: 'Family Court',
    };

    const legalFormsSearchService = {
      searchByIntent: jest.fn().mockResolvedValue([
        { form, combinedScore: 0.82, vectorScore: 0.7, lexicalScore: 0.9 },
      ]),
    } as unknown as LegalFormsSearchService;

    const legalFormsService = {} as LegalFormsService;

    const controller = new LegalFormsController(
      legalFormsService,
      legalFormsSearchService,
    );

    const result = await controller.intentSearch('maintenance wife', 'IN', '10');

    expect(legalFormsSearchService.searchByIntent).toHaveBeenCalledWith(
      'maintenance wife',
      { countryCode: 'IN', limit: 10 },
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].formName).toBe('Maintenance Application');
    expect(result.scores).toEqual([0.82]);
  });

  it('returns divorce-ranked hits for divorce query', async () => {
    const divorceForm = {
      id: 'd1',
      formName: 'Divorce Petition',
      authority: 'District Court',
    };
    const rtiForm = {
      id: 'r1',
      formName: 'RTI Application',
      authority: 'State RTI',
    };

    const legalFormsSearchService = {
      searchByIntent: jest.fn().mockResolvedValue([
        { form: divorceForm, combinedScore: 0.9, vectorScore: 0.8, lexicalScore: 0.85 },
        { form: rtiForm, combinedScore: 0.1, vectorScore: 0.05, lexicalScore: 0.1 },
      ]),
    } as unknown as LegalFormsSearchService;

    const controller = new LegalFormsController(
      {} as LegalFormsService,
      legalFormsSearchService,
    );

    const result = await controller.intentSearch('divorce petition wife', 'IN', '20');

    expect(result.items[0].formName).toBe('Divorce Petition');
    expect(result.scores[0]).toBeGreaterThan(result.scores[1]);
  });
});
