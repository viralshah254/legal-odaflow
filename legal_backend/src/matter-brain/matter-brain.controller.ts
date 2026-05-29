import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { MatterBrainService } from './matter-brain.service';

@Controller('matters')
@UseGuards(TenantGuard)
export class MatterBrainController {
  constructor(private readonly matterBrainService: MatterBrainService) {}

  @Get(':matterId/brain')
  getBrain(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
  ) {
    return this.matterBrainService.getBrain(
      tenantId,
      matterId,
      user.id,
      user.tenantRole,
    );
  }
}
