import {
  Body,
  Controller,
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
import {
  CreateAssistanceRequestDto,
  UpdateAssistanceRequestDto,
} from './dto/assistance.dto';
import { AssistanceService } from './assistance.service';

@Controller('matters/:matterId/assistance')
@UseGuards(TenantGuard)
export class AssistanceController {
  constructor(private readonly assistanceService: AssistanceService) {}

  @Post()
  create(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateAssistanceRequestDto,
  ) {
    return this.assistanceService.create(
      tenantId,
      matterId,
      user.id,
      user.tenantRole,
      dto,
    );
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
  ) {
    return this.assistanceService.findAll(
      tenantId,
      matterId,
      user.id,
      user.tenantRole,
      status,
    );
  }

  @Get(':requestId')
  findOne(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.assistanceService.findOne(
      tenantId,
      matterId,
      requestId,
      user.id,
      user.tenantRole,
    );
  }

  @Patch(':requestId')
  update(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateAssistanceRequestDto,
  ) {
    return this.assistanceService.update(
      tenantId,
      matterId,
      requestId,
      user.id,
      user.tenantRole,
      dto,
    );
  }
}
