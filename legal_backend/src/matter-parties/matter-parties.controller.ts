import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { CreateMatterPartyDto, UpdateMatterPartyDto } from './dto/matter-party.dto';
import { MatterPartiesService } from './matter-parties.service';

@Controller('matters/:matterId/parties')
@UseGuards(TenantGuard)
export class MatterPartiesController {
  constructor(private readonly service: MatterPartiesService) {}

  @Post()
  create(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateMatterPartyDto,
  ) {
    return this.service.create(tenantId, matterId, user.id, user.tenantRole, dto);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.findAll(tenantId, matterId, user.id, user.tenantRole);
  }

  @Patch(':partyId')
  update(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('partyId') partyId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateMatterPartyDto,
  ) {
    return this.service.update(
      tenantId,
      matterId,
      partyId,
      user.id,
      user.tenantRole,
      dto,
    );
  }

  @Delete(':partyId')
  remove(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('partyId') partyId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.remove(
      tenantId,
      matterId,
      partyId,
      user.id,
      user.tenantRole,
    );
  }
}
