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
import { MonitorsService } from './monitors.service';
import { CreateMonitorDto, UpdateMonitorDto, UpdateMonitorHitDto } from './dto/monitor.dto';

@Controller('monitors')
@UseGuards(TenantGuard)
export class MonitorsController {
  constructor(private readonly monitorsService: MonitorsService) {}

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateMonitorDto) {
    return this.monitorsService.createMonitor(tenantId, dto);
  }

  @Get()
  list(@TenantId() tenantId: string, @Query('summary') summary?: string) {
    if (summary === 'true') {
      return this.monitorsService.getHitsSummary(tenantId);
    }
    return this.monitorsService.listMonitors(tenantId);
  }

  @Get(':monitorId')
  get(@TenantId() tenantId: string, @Param('monitorId') monitorId: string) {
    return this.monitorsService.getMonitor(tenantId, monitorId);
  }

  @Patch(':monitorId')
  update(
    @TenantId() tenantId: string,
    @Param('monitorId') monitorId: string,
    @Body() dto: UpdateMonitorDto,
  ) {
    return this.monitorsService.updateMonitor(tenantId, monitorId, dto);
  }

  @Delete(':monitorId')
  remove(@TenantId() tenantId: string, @Param('monitorId') monitorId: string) {
    return this.monitorsService.deleteMonitor(tenantId, monitorId);
  }

  @Get('hits')
  listAllHits(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.monitorsService.listAllHits(tenantId, status, limit ? parseInt(limit, 10) : 50);
  }

  @Get(':monitorId/hits')
  listHits(
    @TenantId() tenantId: string,
    @Param('monitorId') monitorId: string,
    @Query('status') status?: string,
  ) {
    return this.monitorsService.listHits(tenantId, monitorId, status);
  }

  @Patch(':monitorId/hits/:hitId')
  updateHit(
    @TenantId() tenantId: string,
    @Param('monitorId') monitorId: string,
    @Param('hitId') hitId: string,
    @Body() dto: UpdateMonitorHitDto,
  ) {
    return this.monitorsService.updateHit(tenantId, monitorId, hitId, dto);
  }
}
