import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { CreateRateTableDto, UpdateRateTableDto } from './dto/rate-table.dto';
import { RateTablesService } from './rate-tables.service';

@Controller('billing/rate-tables')
@UseGuards(TenantGuard)
export class RateTablesController {
  constructor(private readonly rateTablesService: RateTablesService) {}

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.rateTablesService.findAll(tenantId);
  }

  @Get(':rateTableId')
  findOne(@TenantId() tenantId: string, @Param('rateTableId') rateTableId: string) {
    return this.rateTablesService.findOne(tenantId, rateTableId);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateRateTableDto) {
    return this.rateTablesService.create(tenantId, dto);
  }

  @Patch(':rateTableId')
  update(
    @TenantId() tenantId: string,
    @Param('rateTableId') rateTableId: string,
    @Body() dto: UpdateRateTableDto,
  ) {
    return this.rateTablesService.update(tenantId, rateTableId, dto);
  }
}
