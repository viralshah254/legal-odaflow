import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { MattersService } from './matters.service';
import { CreateMatterDto } from './dto/create-matter.dto';
import { UpdateMatterDto } from './dto/update-matter.dto';

@Controller('matters')
@UseGuards(TenantGuard)
export class MattersController {
  constructor(private readonly mattersService: MattersService) {}

  @Post()
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateMatterDto,
  ) {
    return this.mattersService.create(tenantId, dto, user.id);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
  ) {
    return this.mattersService.findAll(tenantId, user.id, user.tenantRole, status);
  }

  @Get(':matterId')
  findOne(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
  ) {
    return this.mattersService.findOne(tenantId, matterId, user.id, user.tenantRole);
  }

  @Patch(':matterId')
  update(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
    @Body() dto: UpdateMatterDto,
  ) {
    return this.mattersService.update(
      tenantId,
      matterId,
      user.id,
      user.tenantRole,
      dto,
    );
  }

  @Delete(':matterId')
  remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
  ) {
    return this.mattersService.remove(tenantId, matterId, user.id, user.tenantRole);
  }
}
