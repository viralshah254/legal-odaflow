import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(TenantGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('global')
  global(
    @TenantId() tenantId: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.globalSearch(
      tenantId,
      q ?? '',
      limit ? Math.min(20, Number(limit) || 8) : 8,
    );
  }
}
