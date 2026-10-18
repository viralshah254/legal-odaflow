import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { DraftTrainingRedactionService } from './draft-training-redaction.service';

export interface DraftFeedbackInput {
  tenantId: string;
  userId: string;
  documentKind: string;
  sectionType: string;
  jurisdiction?: string;
  rating: 'accepted' | 'minor_edit' | 'major_edit' | 'rejected';
  editCategories?: string[];
  aiText: string;
  userText?: string;
  /** Raw caseDetails from the draft — used purely for party-name extraction before redaction */
  caseDetails?: string;
  knownParties?: string[];
  courtDraftRecordId?: string;
  draftSectionV3Id?: string;
  draftJobSectionId?: string;
  verificationOutcome?: string;
  modelUsed?: string;
}

@Injectable()
export class DraftFeedbackService {
  private readonly logger = new Logger(DraftFeedbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redaction: DraftTrainingRedactionService,
  ) {}

  /**
   * Record explicit or implicit feedback on a single AI-generated section.
   *
   * Flow:
   *   1. Check tenant TrainingConsent — silently skip if not granted.
   *   2. Redact both texts (PII + legal-specific patterns).
   *   3. Compute edit metrics.
   *   4. Persist DraftSectionFeedback row.
   */
  async record(input: DraftFeedbackInput): Promise<void> {
    const allowed = await this.isTrainingAllowed(input.tenantId, input.userId);
    if (!allowed) {
      this.logger.debug(`Training consent not granted for tenant ${input.tenantId} — skipping feedback`);
      return;
    }

    const redacted = this.redaction.redactPair(
      input.aiText,
      input.userText ?? input.aiText,
      { caseDetails: input.caseDetails, knownParties: input.knownParties },
    );

    const { editDistance, editRatio } = this.computeEditMetrics(
      redacted.aiText,
      redacted.userText,
    );

    const derivedRating = this.deriveRating(editRatio, input.rating);

    await (this.prisma as any).draftSectionFeedback.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        documentKind: input.documentKind,
        sectionType: input.sectionType,
        jurisdiction: input.jurisdiction,
        rating: derivedRating,
        editCategories: input.editCategories ?? [],
        aiGeneratedText: redacted.aiText,
        userEditedText: derivedRating === 'accepted' ? null : redacted.userText,
        editDistance,
        editRatio,
        courtDraftRecordId: input.courtDraftRecordId,
        draftSectionV3Id: input.draftSectionV3Id,
        draftJobSectionId: input.draftJobSectionId,
        verificationOutcome: input.verificationOutcome ?? null,
        modelUsed: input.modelUsed ?? null,
      },
    }).catch((err: unknown) => {
      this.logger.error(`Failed to save draft feedback: ${String(err)}`);
    });
  }

  private async isTrainingAllowed(tenantId: string, userId: string): Promise<boolean> {
    const consent = await this.prisma.trainingConsent.findFirst({
      where: {
        consentStatus: 'GRANTED',
        OR: [
          { tenantId, userId },
          { tenantId, userId: null },
          { tenantId: null, userId },
        ],
      },
      select: { canUseForPromptImprove: true },
    }).catch(() => null);

    return !!(consent?.canUseForPromptImprove);
  }

  private deriveRating(editRatio: number, explicit: DraftFeedbackInput['rating']): string {
    if (explicit === 'accepted' || explicit === 'rejected') return explicit;
    if (editRatio < 0.05) return 'accepted';
    if (editRatio < 0.25) return 'minor_edit';
    return 'major_edit';
  }

  private computeEditMetrics(aiText: string, userText: string): { editDistance: number; editRatio: number } {
    if (aiText === userText) return { editDistance: 0, editRatio: 0 };

    const a = aiText.toLowerCase().slice(0, 3000);
    const b = userText.toLowerCase().slice(0, 3000);

    const bigramsA = new Set<string>();
    for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2));

    let shared = 0;
    for (let i = 0; i < b.length - 1; i++) {
      if (bigramsA.has(b.slice(i, i + 2))) shared++;
    }

    const total = (a.length + b.length) / 2;
    const similarity = shared / Math.max(total, 1);
    const editRatio = Math.min(1 - similarity, 1);
    const editDistance = Math.round(editRatio * Math.max(a.length, b.length));

    return { editDistance, editRatio };
  }
}
