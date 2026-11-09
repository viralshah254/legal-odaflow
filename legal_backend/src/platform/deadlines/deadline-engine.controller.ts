import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { DeadlineEngineService } from './deadline-engine.service';

@Controller()
@UseGuards(TenantGuard)
export class DeadlineEngineController {
  constructor(private readonly svc: DeadlineEngineService) {}

  @Get('deadlines')
  getAllDeadlines(
    @TenantId() tenantId: string,
    @Query('matterId') matterId?: string,
    @Query('status') status?: string,
    @Query('dueBefore') dueBefore?: string,
  ) {
    return this.svc.getAllDeadlines(tenantId, {
      matterId,
      status,
      dueBefore: dueBefore ? new Date(dueBefore) : undefined,
    });
  }

  @Get('deadlines/rules')
  findRules(
    @Query('jurisdiction') jurisdiction: string,
    @Query('matterType') matterType: string,
    @Query('deadlineType') deadlineType?: string,
  ) {
    return this.svc.findRules(jurisdiction, matterType, deadlineType);
  }

  @Post('deadlines/calculate')
  async calculateDeadline(
    @Body() body: { ruleId: string; triggerDate: string },
  ) {
    const rule = await this.svc['prisma'].deadlineRule.findUnique({
      where: { id: body.ruleId },
    });
    if (!rule) return { error: 'Rule not found' };
    const dueDate = this.svc.calculateDeadline(rule, new Date(body.triggerDate));
    return { dueDate };
  }

  @Post('matters/:matterId/deadlines/recompute')
  @HttpCode(HttpStatus.OK)
  async recomputeFromFacts(
    @Param('matterId') matterId: string,
    @TenantId() tenantId: string,
  ) {
    const matter = await this.svc['prisma'].matter.findFirst({
      where: { id: matterId, tenantId },
      select: { id: true },
    });
    if (!matter) throw new NotFoundException('Matter not found');
    const facts = await this.svc['prisma'].matterFactV2.findMany({
      where: { matterId },
    });
    return this.svc.detectDeadlinesFromFacts(matterId, tenantId, facts);
  }
}
