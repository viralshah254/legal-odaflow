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
  CreateAutomationRuleDto,
  CreateAutomationRunDto,
  UpdateAutomationRuleDto,
} from './dto/automation.dto';
import { AutomationsService } from './automations.service';

@Controller('automations')
@UseGuards(TenantGuard)
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Post('rules')
  createRule(
    @TenantId() tenantId: string,
    @Body() dto: CreateAutomationRuleDto,
  ) {
    return this.automationsService.createRule(tenantId, dto);
  }

  @Post('rules/seed')
  seedRules(@TenantId() tenantId: string) {
    return this.automationsService.seedBuiltInRules(tenantId);
  }

  @Post('rules/reset-defaults')
  resetDefaults(@TenantId() tenantId: string) {
    return this.automationsService.resetBuiltInRules(tenantId);
  }

  @Get('recipes')
  listRecipes() {
    return this.automationsService.listBuiltInCatalog();
  }

  @Get('rules')
  findRules(
    @TenantId() tenantId: string,
    @Query('isEnabled') isEnabled?: string,
  ) {
    return this.automationsService.findRules(tenantId, isEnabled);
  }

  @Get('rules/:ruleId')
  findRule(
    @TenantId() tenantId: string,
    @Param('ruleId') ruleId: string,
  ) {
    return this.automationsService.findRule(tenantId, ruleId);
  }

  @Patch('rules/:ruleId')
  updateRule(
    @TenantId() tenantId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateAutomationRuleDto,
  ) {
    return this.automationsService.updateRule(tenantId, ruleId, dto);
  }

  @Delete('rules/:ruleId')
  removeRule(
    @TenantId() tenantId: string,
    @Param('ruleId') ruleId: string,
  ) {
    return this.automationsService.removeRule(tenantId, ruleId);
  }

  @Post('runs')
  createRun(
    @TenantId() tenantId: string,
    @Body() dto: CreateAutomationRunDto,
  ) {
    return this.automationsService.createRun(tenantId, dto);
  }

  @Get('runs')
  findRuns(
    @TenantId() tenantId: string,
    @Query('ruleId') ruleId?: string,
    @Query('status') status?: string,
  ) {
    return this.automationsService.findRuns(tenantId, ruleId, status);
  }
}
