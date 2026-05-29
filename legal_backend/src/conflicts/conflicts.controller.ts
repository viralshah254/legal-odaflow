import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import type { RequestUser } from '@/common/types/request-user.interface';
import { ConflictsService } from './conflicts.service';
import { CreateConflictCheckDto } from './dto/conflicts.dto';

@Controller('conflicts')
@UseGuards(TenantGuard)
export class ConflictsController {
  constructor(private readonly conflictsService: ConflictsService) {}

  @Get()
  list(@TenantId() tenantId: string, @Query('status') status?: string) {
    return this.conflictsService.list(tenantId, status);
  }

  @Get(':id')
  get(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.conflictsService.getById(tenantId, id);
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateConflictCheckDto,
  ) {
    return this.conflictsService.create(tenantId, user.id, dto);
  }
}
