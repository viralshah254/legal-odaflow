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
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import {
  CreateAlertActionDto,
  CreateAlertDto,
  UpdateAlertDto,
} from './dto/alert.dto';
import { AlertsService } from './alerts.service';

@Controller('alerts')
@UseGuards(TenantGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateAlertDto) {
    return this.alertsService.create(tenantId, dto);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('matterId') matterId?: string,
  ) {
    return this.alertsService.findAll(tenantId, status, matterId);
  }

  @Get('urgent')
  findUrgent(@TenantId() tenantId: string) {
    return this.alertsService.findUrgent(tenantId);
  }

  @Get(':alertId')
  findOne(
    @TenantId() tenantId: string,
    @Param('alertId') alertId: string,
  ) {
    return this.alertsService.findOne(tenantId, alertId);
  }

  @Patch(':alertId')
  update(
    @TenantId() tenantId: string,
    @Param('alertId') alertId: string,
    @Body() dto: UpdateAlertDto,
  ) {
    return this.alertsService.update(tenantId, alertId, dto);
  }

  @Delete(':alertId')
  remove(
    @TenantId() tenantId: string,
    @Param('alertId') alertId: string,
  ) {
    return this.alertsService.remove(tenantId, alertId);
  }

  @Post(':alertId/actions')
  addAction(
    @TenantId() tenantId: string,
    @Param('alertId') alertId: string,
    @Body() dto: CreateAlertActionDto,
  ) {
    return this.alertsService.addAction(tenantId, alertId, dto);
  }

  @Post(':alertId/complete')
  complete(@TenantId() tenantId: string, @Param('alertId') alertId: string) {
    return this.alertsService.complete(tenantId, alertId);
  }

  @Post(':alertId/skip')
  skip(@TenantId() tenantId: string, @Param('alertId') alertId: string) {
    return this.alertsService.skip(tenantId, alertId);
  }

  @Post(':alertId/acknowledge')
  acknowledge(@TenantId() tenantId: string, @Param('alertId') alertId: string) {
    return this.alertsService.acknowledge(tenantId, alertId);
  }
}
