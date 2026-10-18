import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { LegalLocationService } from '@/legal-location/legal-location.service';
import { DraftIntentService } from './draft-intent.service';
import { DraftIntentAnalyzeService } from './draft-intent-analyze.service';
import { AnalyzeDraftIntentDto, ResolveDraftIntentDto } from './dto/resolve-draft-intent.dto';

@Controller('ai/draft-intent')
@UseGuards(TenantGuard)
export class DraftIntentController {
  constructor(
    private readonly draftIntent: DraftIntentService,
    private readonly draftIntentAnalyze: DraftIntentAnalyzeService,
    private readonly legalLocation: LegalLocationService,
  ) {}

  @Post('resolve')
  async resolve(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: ResolveDraftIntentDto,
  ) {
    const location = await this.legalLocation.resolve({
      userId: user.id,
      tenantId,
      requestCountryCode: dto.countryCode,
      requestJurisdiction: dto.jurisdiction ?? dto.context?.jurisdiction,
    });

    return this.draftIntent.resolve({
      query: dto.query,
      tenantId,
      userId: user.id,
      countryCode: location.countryCode,
      jurisdiction: location.jurisdiction ?? dto.jurisdiction ?? dto.context?.jurisdiction,
      answers: dto.answers,
      context: dto.context,
      supplementalContext: dto.supplementalContext,
      skipClarification: dto.skipClarification,
      language: dto.language,
    });
  }

  /** Free pre-analysis — no credits charged. Extracts context and returns clarifying questions. */
  @Post('analyze')
  analyze(@Body() dto: AnalyzeDraftIntentDto) {
    return this.draftIntentAnalyze.analyze(dto.query, dto.supplementalContext);
  }
}
