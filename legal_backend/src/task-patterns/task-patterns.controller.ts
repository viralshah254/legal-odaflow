import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { TaskPatternsService } from './task-patterns.service';
import type { TaskPatternFeature, TaskPatternUsageEvent } from './task-patterns.types';

@Controller('task-patterns')
export class TaskPatternsController {
  constructor(private readonly taskPatterns: TaskPatternsService) {}

  @Get()
  list(
    @Query('jurisdiction') jurisdiction?: string,
    @Query('targetFeature') targetFeature?: TaskPatternFeature,
    @Query('practiceArea') practiceArea?: string,
    @Query('q') q?: string,
  ) {
    return this.taskPatterns.list({ jurisdiction, targetFeature, practiceArea, q });
  }

  @Get('practice-areas')
  practiceAreas(@Query('jurisdiction') jurisdiction?: string) {
    return this.taskPatterns.practiceAreas(jurisdiction);
  }

  @Get('analytics/usage')
  usageAnalytics(
    @Query('tenantId') tenantId?: string,
    @Query('windowDays') windowDays?: string,
  ) {
    const days = windowDays ? Math.min(Math.max(parseInt(windowDays, 10) || 30, 7), 90) : 30;
    return this.taskPatterns.getUsageAnalytics(tenantId, days);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.taskPatterns.getById(id);
  }

  @Post(':id/use')
  async recordUse(@Param('id') id: string, @Body() body: Partial<TaskPatternUsageEvent>) {
    const pattern = this.taskPatterns.getById(id);
    if (!pattern) {
      return { ok: false, error: 'Pattern not found' };
    }
    return this.taskPatterns.recordUsage({
      patternId: pattern.id,
      targetFeature: body.targetFeature ?? pattern.targetFeature,
      jurisdiction: body.jurisdiction ?? pattern.jurisdiction,
      tenantId: body.tenantId,
      userId: body.userId,
    });
  }
}
