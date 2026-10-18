import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { RequestUser } from '@/common/types/request-user.interface';
import { WorkContextService } from './work-context.service';
import { StartWorkRequestDto } from './start-work.dto';

@Controller('work-context')
@UseGuards(TenantGuard)
export class WorkContextController {
  constructor(private readonly workContext: WorkContextService) {}

  @Post('start')
  start(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: StartWorkRequestDto,
  ) {
    return this.workContext.startWork(
      { tenantId, userId: user.id, tenantRole: user.tenantRole },
      dto,
    );
  }
}
