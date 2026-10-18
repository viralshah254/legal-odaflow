import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { RequestUser } from '../common/types/request-user.interface';
import {
  MatterBudgetService,
  CreateMatterBudgetDto,
  UpdateMatterBudgetDto,
} from './matter-budget.service';

@Controller('matters/:matterId/budget')
@UseGuards(JwtAuthGuard)
export class MatterBudgetController {
  constructor(private readonly budgetService: MatterBudgetService) {}

  @Get()
  getSummary(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    return this.budgetService.getBudgetSummary(tenantId, matterId);
  }

  @Post()
  upsert(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Body() dto: CreateMatterBudgetDto,
  ) {
    return this.budgetService.upsert(tenantId, matterId, dto);
  }

  @Put()
  update(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Body() dto: UpdateMatterBudgetDto,
  ) {
    return this.budgetService.update(tenantId, matterId, dto);
  }

  @Post('sync-actuals')
  syncActuals(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    return this.budgetService.syncActuals(tenantId, matterId);
  }
}
