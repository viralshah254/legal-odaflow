import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { FirmMemoryService } from './firm-memory.service';

@Controller('firm-memory')
@UseGuards(TenantGuard)
export class FirmMemoryController {
  constructor(private readonly firmMemoryService: FirmMemoryService) {}

  @Get('search')
  search(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.min(Math.max(Number(limit), 1), 50) : 20;
    return this.firmMemoryService.search(
      tenantId,
      user.id,
      user.tenantRole,
      query ?? '',
      Number.isFinite(parsedLimit) ? parsedLimit : 20,
    );
  }
}
