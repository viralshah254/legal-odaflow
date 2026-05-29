import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { ClioImportDto } from './dto/clio-import.dto';
import { MigrationService } from './migration.service';

@Controller('migration')
@UseGuards(TenantGuard)
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

  @Post('clio/import')
  importClio(@TenantId() tenantId: string, @Body() dto: ClioImportDto) {
    return this.migrationService.importClioCsv(tenantId, dto);
  }

  @Get('clio/jobs/:jobId')
  getClioJobStatus(
    @TenantId() tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.migrationService.getJobStatus(tenantId, jobId);
  }
}
