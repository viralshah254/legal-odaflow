import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles('FIRM_ADMIN', 'SUPER_ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  listUsers() {
    return this.adminService.listUsers();
  }

  @Get('tenants')
  listTenants() {
    return this.adminService.listTenants();
  }

  @Get('ai/costs')
  listAiCosts() {
    return this.adminService.listAiCosts();
  }

  @Get('ai/usage')
  getAiUsage() {
    return this.adminService.getUnitEconomicsSummary();
  }

  @Get('ai/logs')
  listAiLogs() {
    return this.adminService.listAiLogs();
  }

  @Get('training-datasets')
  listTrainingDatasets() {
    return this.adminService.listTrainingDatasets();
  }

  @Get('legal-sources')
  listLegalSources() {
    return this.adminService.listLegalSources();
  }

  @Get('audit/logs')
  listAuditLogs() {
    return this.adminService.listAuditLogs();
  }

  @Get('costs/summary')
  getCostsSummary() {
    return this.adminService.getUnitEconomicsSummary();
  }
}
