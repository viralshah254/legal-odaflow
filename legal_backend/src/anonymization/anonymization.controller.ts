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
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { AnonymizationService } from './anonymization.service';
import {
  CreateAnonymizationJobDto,
  UpdateAnonymizationJobDto,
} from './dto/anonymization.dto';

@Controller('anonymization')
@UseGuards(TenantGuard, RolesGuard)
@Roles('FIRM_ADMIN', 'PARTNER')
export class AnonymizationController {
  constructor(private readonly anonymizationService: AnonymizationService) {}

  @Get()
  findAll(@TenantId() tenantId: string, @Query('status') status?: string) {
    return this.anonymizationService.findAll(tenantId, status);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.anonymizationService.findOne(id, tenantId);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateAnonymizationJobDto) {
    return this.anonymizationService.create(tenantId, dto);
  }

  @Patch(':id')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAnonymizationJobDto,
  ) {
    return this.anonymizationService.update(id, tenantId, dto);
  }

  @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.anonymizationService.remove(id, tenantId);
  }
}
