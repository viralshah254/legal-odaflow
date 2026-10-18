import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { DraftFeedbackService } from './draft-feedback.service';

class DraftFeedbackDto {
  sectionType!: string;
  documentKind!: string;
  rating!: 'accepted' | 'minor_edit' | 'major_edit' | 'rejected';
  aiText!: string;
  userText?: string;
  jurisdiction?: string;
  editCategories?: string[];
  caseDetails?: string;
  knownParties?: string[];
  courtDraftRecordId?: string;
  draftSectionV3Id?: string;
  draftJobSectionId?: string;
  verificationOutcome?: string;
  modelUsed?: string;
}

@Controller('drafts/feedback')
@UseGuards(JwtAuthGuard)
export class DraftFeedbackController {
  constructor(private readonly feedbackService: DraftFeedbackService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async record(@Body() dto: DraftFeedbackDto, @Req() req: any): Promise<void> {
    await this.feedbackService.record({
      tenantId: req.user.tenantId,
      userId: req.user.userId,
      documentKind: dto.documentKind,
      sectionType: dto.sectionType,
      jurisdiction: dto.jurisdiction,
      rating: dto.rating,
      editCategories: dto.editCategories,
      aiText: dto.aiText,
      userText: dto.userText,
      caseDetails: dto.caseDetails,
      knownParties: dto.knownParties,
      courtDraftRecordId: dto.courtDraftRecordId,
      draftSectionV3Id: dto.draftSectionV3Id,
      draftJobSectionId: dto.draftJobSectionId,
      verificationOutcome: dto.verificationOutcome,
      modelUsed: dto.modelUsed,
    });
  }
}
