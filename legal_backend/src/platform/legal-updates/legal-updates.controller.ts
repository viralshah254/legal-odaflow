import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { LegalUpdatesService } from './legal-updates.service';

@Controller()
@UseGuards(TenantGuard)
export class LegalUpdatesController {
  constructor(private readonly legalUpdatesService: LegalUpdatesService) {}

  @Get('legal-updates')
  listUpdates(
    @Query('jurisdiction') jurisdiction?: string,
    @Query('status') status?: string,
  ) {
    return this.legalUpdatesService.listUpdates(jurisdiction, status);
  }

  @Get('legal-updates/:id')
  getUpdate(@Param('id') id: string) {
    return this.legalUpdatesService.getUpdate(id);
  }

  @Get('legal-updates/:id/impacts')
  getImpacts(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.legalUpdatesService.getImpactedResearch(id, tenantId);
  }

  @Post('legal-updates/:id/review')
  reviewUpdate(@Param('id') id: string, @Body() body: { status: string }) {
    return this.legalUpdatesService.reviewUpdate(id, body.status);
  }

  @Get('matters/:matterId/legal-updates')
  getMatterLegalUpdates(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    return this.legalUpdatesService.getMatterLegalUpdates(matterId, tenantId);
  }
}
