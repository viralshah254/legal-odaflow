import { Test } from '@nestjs/testing';
import { IndiaDraftVerificationService } from '@/ai/india-draft/india-draft-verification.service';
import { DraftVerificationService } from '@/ai/drafting/draft-verification.service';

describe('IndiaDraftVerificationService', () => {
  let service: IndiaDraftVerificationService;
  let draftVerification: {
    verify: jest.Mock;
    buildVerificationExplanation: jest.Mock;
  };

  beforeEach(async () => {
    draftVerification = {
      verify: jest.fn().mockResolvedValue({
        draft: 'corrected',
        audit: {
          corrections: [],
          similarCases: [],
          sectionChecks: { entries: [], anyCorrections: false, anyUnconfirmedMismatches: false },
          citationWarnings: [],
          strippedCitations: [],
          proceduralWarnings: [],
          completenessGaps: [],
          requiresLawyerReview: false,
          verificationStatus: 'verified',
        },
      }),
      buildVerificationExplanation: jest.fn().mockReturnValue('Reviewed against corpus.'),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        IndiaDraftVerificationService,
        { provide: DraftVerificationService, useValue: draftVerification },
      ],
    }).compile();

    service = moduleRef.get(IndiaDraftVerificationService);
  });

  it('delegates verify to DraftVerificationService with countryCode IN', async () => {
    await service.verify({
      draft: 'draft text',
      kind: 'india_maintenance_application_bnss_144',
      caseDetails: 'Wife maintenance',
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(draftVerification.verify).toHaveBeenCalledWith(
      expect.objectContaining({
        countryCode: 'IN',
        draft: 'draft text',
      }),
    );
  });

  it('delegates buildVerificationExplanation to DraftVerificationService', () => {
    const audit = {
      corrections: [],
      similarCases: [],
      sectionChecks: { entries: [], anyCorrections: false, anyUnconfirmedMismatches: false },
      citationWarnings: [],
      strippedCitations: [],
      proceduralWarnings: [],
      completenessGaps: [],
      requiresLawyerReview: false,
      verificationStatus: 'verified' as const,
    };

    const explanation = service.buildVerificationExplanation(audit);

    expect(draftVerification.buildVerificationExplanation).toHaveBeenCalledWith(audit);
    expect(explanation).toBe('Reviewed against corpus.');
  });
});
