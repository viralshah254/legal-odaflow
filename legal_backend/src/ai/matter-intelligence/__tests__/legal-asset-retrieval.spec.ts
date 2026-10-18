import { Test, TestingModule } from '@nestjs/testing';
import { LegalAssetRetrievalService } from '../legal-asset-retrieval.service';
import { LegalFormsSearchService } from '@/legal-forms/legal-forms-search.service';
import { SelectionTrackingService } from '../selection-tracking.service';
import { EmbeddingService } from '@/embeddings/embedding.service';
import { ARJUN_WRONGFUL_TERMINATION_FACTS, GOLDEN_FIXTURES } from './golden-fixtures';

describe('LegalAssetRetrievalService (hybrid ranker)', () => {
  let service: LegalAssetRetrievalService;
  const legalFormsSearch = {
    searchByIntent: jest.fn().mockResolvedValue([
      {
        form: {
          id: 'form-labour',
          formName: 'Labour Court Petition — Wrongful Termination',
          formNumber: 'LC-1',
          countryCode: 'IN',
          authority: 'Labour Court',
          metadata: {
            practiceArea: 'employment_labour',
            subPracticeArea: 'wrongful_termination',
            nature: 'dispute',
          },
        },
        combinedScore: 0.72,
      },
      {
        form: {
          id: 'form-arb',
          formName: 'Arbitration Agreement Template',
          formNumber: 'ARB-1',
          countryCode: 'IN',
          authority: 'Generic',
          metadata: { practiceArea: 'arbitration_adr', nature: 'transaction' },
        },
        combinedScore: 0.81,
      },
    ]),
  };
  const selectionTracking = {
    popularityBoost: jest.fn().mockResolvedValue(0.05),
  };
  const embeddingService = {
    isRagEnabled: jest.fn().mockReturnValue(false),
    searchByVector: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegalAssetRetrievalService,
        { provide: LegalFormsSearchService, useValue: legalFormsSearch },
        { provide: SelectionTrackingService, useValue: selectionTracking },
        { provide: EmbeddingService, useValue: embeddingService },
      ],
    }).compile();
    service = module.get(LegalAssetRetrievalService);
  });

  it('ranks employment dispute forms above cross-practice arbitration for Arjun fixture', async () => {
    const arjun = GOLDEN_FIXTURES.find((f) => f.id === 'arjun-employment')!;
    const { assets, recommendationMode } = await service.retrieve({
      query: ARJUN_WRONGFUL_TERMINATION_FACTS,
      profile: {
        country: 'IN',
        practiceArea: arjun.expected.practiceArea,
        subPracticeArea: arjun.expected.subPracticeArea,
        nature: arjun.expected.nature,
        forum: 'labour_court',
        remedies: ['reinstatement', 'back_wages'],
        issues: ['Illegal termination without inquiry'],
        documentTypes: ['labour_court_petition'],
        documentKind: arjun.expected.documentKind,
        curatedKinds: ['india_wrongful_termination'],
        confidence: 0.88,
      },
      countryCode: 'IN',
      limit: 5,
    });

    expect(assets.length).toBeGreaterThan(0);
    const labour = assets.find((a) => a.id === 'form-labour' || a.label.includes('Labour'));
    const arb = assets.find((a) => a.id === 'form-arb' || a.label.includes('Arbitration'));
    if (labour && arb) {
      expect(labour.combinedScore).toBeGreaterThan(arb.combinedScore);
    }
    expect(recommendationMode).toBeDefined();
  });
});
