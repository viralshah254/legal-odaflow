import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { GrantMatterAccessDto } from './dto/matter-access.dto';
import { MatterAccessManagementService } from './matter-access-management.service';

@Controller('matters/:matterId/access')
@UseGuards(TenantGuard)
export class MatterAccessController {
  constructor(
    private readonly matterAccessManagement: MatterAccessManagementService,
  ) {}

  @Get()
  listAccess(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    return this.matterAccessManagement.listAccess(tenantId, matterId);
  }

  @Post()
  grantAccess(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: GrantMatterAccessDto,
  ) {
    return this.matterAccessManagement.grantAccess(
      tenantId,
      matterId,
      user.id,
      user.tenantRole,
      dto,
    );
  }

  @Delete(':userId')
  revokeAccess(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.matterAccessManagement.revokeAccess(
      tenantId,
      matterId,
      userId,
      user.id,
      user.tenantRole,
    );
  }
}
