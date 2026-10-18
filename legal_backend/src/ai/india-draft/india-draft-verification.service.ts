/**
 * @deprecated Use DraftVerificationService from @/ai/drafting/draft-verification.service
 */
import { Injectable } from '@nestjs/common';
import { DraftVerificationService } from '@/ai/drafting/draft-verification.service';
import type {
  DraftVerificationAudit,
  DraftVerifyInput,
  DraftVerifyResult,
} from '@/ai/drafting/draft-verification.types';

export type IndiaDraftVerificationAudit = DraftVerificationAudit;

export type IndiaDraftVerifyInput = Omit<DraftVerifyInput, 'countryCode'>;

export type IndiaDraftVerifyResult = DraftVerifyResult;

@Injectable()
export class IndiaDraftVerificationService {
  constructor(private readonly draftVerification: DraftVerificationService) {}

  verify(input: IndiaDraftVerifyInput): Promise<IndiaDraftVerifyResult> {
    return this.draftVerification.verify({
      ...input,
      countryCode: 'IN',
    });
  }

  buildVerificationExplanation(audit: IndiaDraftVerificationAudit): string {
    return this.draftVerification.buildVerificationExplanation(audit);
  }

  addVerifiedCitations(
    input: Omit<Parameters<DraftVerificationService['addVerifiedCitations']>[0], 'countryCode'>,
  ) {
    return this.draftVerification.addVerifiedCitations({ ...input, countryCode: 'IN' });
  }
}

export type { DraftVerificationAudit as IndiaDraftVerificationAuditType };
