import type { JurisdictionForm } from '@prisma/client';
import { LegalFormsSearchService } from '@/legal-forms/legal-forms-search.service';
import { LegalFormsService } from '@/legal-forms/legal-forms.service';
import { EmbeddingService } from '@/embeddings/embedding.service';

describe('LegalFormsSearchService', () => {
  const c1a = {
    id: 'form-c1a',
    formName: 'Allegations of Harm and Domestic Violence',
    formNumber: 'C1A',
    authority: 'HM Courts & Tribunals Service',
    description: 'Family court form for allegations of harm and domestic violence',
    practiceArea: 'FAMILY_MATRIMONIAL',
    category: 'Family',
    countryCode: 'GB',
    jurisdiction: 'England & Wales',
  } as JurisdictionForm;

  const serviceAgreement = {
    id: 'form-sa',
    formName: 'Standard Service Agreement Template',
    formNumber: 'SA-1',
    authority: 'Generic',
    description: 'Commercial service agreement between parties',
    practiceArea: 'CORPORATE',
    category: 'Contracts',
    countryCode: 'GB',
    jurisdiction: null,
  } as JurisdictionForm;

  function createService() {
    const legalForms = {
      searchByTokens: jest.fn().mockResolvedValue([c1a]),
      findByIds: jest.fn().mockResolvedValue([c1a]),
    } as unknown as LegalFormsService;

    const embeddingService = {
      searchByVector: jest.fn().mockResolvedValue([
        {
          id: 'chunk-1',
          sourceType: 'JURISDICTION_FORM',
          sourceId: c1a.id,
          chunkIndex: 0,
          content: 'domestic violence',
          countryCode: 'GB',
          score: 0.88,
        },
        {
          id: 'chunk-2',
          sourceType: 'JURISDICTION_FORM',
          sourceId: serviceAgreement.id,
          chunkIndex: 0,
          content: 'service agreement',
          countryCode: 'GB',
          score: 0.42,
        },
      ]),
    } as unknown as EmbeddingService;

    legalForms.findByIds = jest.fn().mockResolvedValue([c1a, serviceAgreement]);

    return {
      service: new LegalFormsSearchService(legalForms, embeddingService),
      legalForms,
      embeddingService,
    };
  }

  it('ranks domestic violence form above unrelated forms for attack/husband query', async () => {
    const { service } = createService();
    const hits = await service.searchByIntent(
      'I was attacked by my husband, I need to draft a complaint',
      { countryCode: 'GB', limit: 5 },
    );

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].form.formNumber).toBe('C1A');
    expect(hits[0].combinedScore).toBeGreaterThan(0.5);
  });

  it('uses tokenized lexical search when vector returns empty', async () => {
    const legalForms = {
      searchByTokens: jest.fn().mockResolvedValue([c1a]),
      findByIds: jest.fn().mockResolvedValue([]),
    } as unknown as LegalFormsService;
    const embeddingService = {
      searchByVector: jest.fn().mockResolvedValue([]),
    } as unknown as EmbeddingService;

    const service = new LegalFormsSearchService(legalForms, embeddingService);
    const hits = await service.searchByIntent('domestic violence complaint husband', {
      countryCode: 'GB',
      limit: 3,
    });

    expect(hits[0]?.form.formNumber).toBe('C1A');
    expect(legalForms.searchByTokens).toHaveBeenCalled();
  });
});
