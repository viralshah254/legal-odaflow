import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { LegalFormsService, LegalFormsQuery } from './legal-forms.service';
import { LegalFormsSearchService } from './legal-forms-search.service';

@Controller('legal-forms')
@UseGuards(JwtAuthGuard)
export class LegalFormsController {
  constructor(
    private readonly legalFormsService: LegalFormsService,
    private readonly legalFormsSearchService: LegalFormsSearchService,
  ) {}

  @Get()
  findAll(@Query() query: LegalFormsQuery) {
    if (query.page || query.limit) {
      return this.legalFormsService.findPaginated(query);
    }
    return this.legalFormsService.findAll(query);
  }

  @Get('intent-search')
  async intentSearch(
    @Query('query') query: string,
    @Query('countryCode') countryCode?: string,
    @Query('limit') limit?: string,
  ) {
    const hits = await this.legalFormsSearchService.searchByIntent(
      query ?? '',
      {
        countryCode,
        limit: limit ? Math.min(parseInt(limit, 10) || 20, 50) : 20,
      },
    );
    return {
      items: hits.map((h) => h.form),
      scores: hits.map((h) => h.combinedScore),
    };
  }

  @Get('by-country/:countryCode')
  groupedByPracticeArea(@Param('countryCode') countryCode: string) {
    return this.legalFormsService.getGroupedByPracticeArea(
      countryCode.toUpperCase(),
    );
  }

  @Get('by-matter/:matterId')
  byMatter(@Param('matterId') matterId: string) {
    return this.legalFormsService.findByMatter(matterId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.legalFormsService.findOne(id);
  }
}
