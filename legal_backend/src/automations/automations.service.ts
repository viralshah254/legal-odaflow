import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BUILT_IN_AUTOMATION_RECIPES,
  extractRecipeKey,
  recipeConditionsWithKey,
} from '@/agents/agent.registry';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateAutomationRuleDto,
  CreateAutomationRunDto,
  UpdateAutomationRuleDto,
} from './dto/automation.dto';

@Injectable()
export class AutomationsService {
  constructor(private readonly prisma: PrismaService) {}

  listBuiltInCatalog() {
    return BUILT_IN_AUTOMATION_RECIPES.map((recipe) => ({
      recipeKey: recipe.recipeKey,
      name: recipe.name,
      description: recipe.description,
      trigger: recipe.trigger,
      conditions: recipe.conditions,
      actions: recipe.actions,
    }));
  }

  async seedBuiltInRules(tenantId: string) {
    let installed = 0;
    let skipped = 0;

    for (const recipe of BUILT_IN_AUTOMATION_RECIPES) {
      const existing = await this.findBuiltInRule(tenantId, recipe.recipeKey, recipe);

      if (existing) {
        skipped += 1;
        continue;
      }

      await this.prisma.automationRule.create({
        data: this.recipeToRuleData(tenantId, recipe),
      });
      installed += 1;
    }

    return {
      installed,
      skipped,
      total: BUILT_IN_AUTOMATION_RECIPES.length,
    };
  }

  async resetBuiltInRules(tenantId: string) {
    let reset = 0;
    let installed = 0;

    for (const recipe of BUILT_IN_AUTOMATION_RECIPES) {
      const existing = await this.findBuiltInRule(tenantId, recipe.recipeKey, recipe);
      const data = this.recipeToRuleData(tenantId, recipe);

      if (existing) {
        await this.prisma.automationRule.update({
          where: { id: existing.id },
          data: {
            name: data.name,
            trigger: data.trigger,
            conditions: data.conditions,
            actions: data.actions,
            isEnabled: true,
          },
        });
        reset += 1;
      } else {
        await this.prisma.automationRule.create({ data });
        installed += 1;
      }
    }

    return {
      reset,
      installed,
      total: BUILT_IN_AUTOMATION_RECIPES.length,
    };
  }

  async createRule(tenantId: string, dto: CreateAutomationRuleDto) {
    const v2Meta = {
      approvalRequired: dto.approvalRequired ?? false,
      slaMinutes: dto.slaMinutes,
      webhookUrl: dto.webhookUrl,
      aiActionType: dto.aiActionType,
    };
    const conditions = {
      ...(dto.conditions ?? {}),
      v2: v2Meta,
    };
    const actions = {
      ...(dto.actions ?? {}),
      ...(dto.aiActionType ? { type: 'ai', aiActionType: dto.aiActionType } : {}),
      ...(dto.webhookUrl ? { webhookUrl: dto.webhookUrl } : {}),
    };

    return this.prisma.automationRule.create({
      data: {
        tenantId,
        name: dto.name,
        trigger: dto.trigger,
        conditions: conditions as Prisma.InputJsonValue,
        actions: actions as Prisma.InputJsonValue,
        isEnabled: dto.isEnabled ?? true,
      },
    });
  }

  async findRules(tenantId: string, isEnabled?: string) {
    return this.prisma.automationRule.findMany({
      where: {
        tenantId,
        isEnabled:
          isEnabled === undefined ? undefined : isEnabled === 'true',
      },
      include: { runs: { orderBy: { startedAt: 'desc' }, take: 5 } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findRule(tenantId: string, ruleId: string) {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id: ruleId, tenantId },
      include: { runs: { orderBy: { startedAt: 'desc' } } },
    });

    if (!rule) {
      throw new NotFoundException('Automation rule not found');
    }

    return rule;
  }

  async updateRule(
    tenantId: string,
    ruleId: string,
    dto: UpdateAutomationRuleDto,
  ) {
    await this.findRule(tenantId, ruleId);

    return this.prisma.automationRule.update({
      where: { id: ruleId },
      data: {
        name: dto.name,
        trigger: dto.trigger,
        conditions: dto.conditions as Prisma.InputJsonValue | undefined,
        actions: dto.actions as Prisma.InputJsonValue | undefined,
        isEnabled: dto.isEnabled,
      },
    });
  }

  async removeRule(tenantId: string, ruleId: string) {
    await this.findRule(tenantId, ruleId);
    await this.prisma.automationRule.delete({ where: { id: ruleId } });
    return { success: true };
  }

  async createRun(tenantId: string, dto: CreateAutomationRunDto) {
    await this.findRule(tenantId, dto.ruleId);

    return this.prisma.automationRun.create({
      data: {
        tenantId,
        ruleId: dto.ruleId,
        status: dto.status ?? 'PENDING',
        result: dto.result as Prisma.InputJsonValue | undefined,
        error: dto.error,
        completedAt: dto.status === 'COMPLETED' ? new Date() : undefined,
      },
    });
  }

  async findRuns(tenantId: string, ruleId?: string, status?: string) {
    return this.prisma.automationRun.findMany({
      where: {
        tenantId,
        ruleId: ruleId || undefined,
        status: status || undefined,
      },
      include: { rule: true },
      orderBy: { startedAt: 'desc' },
    });
  }

  private recipeToRuleData(
    tenantId: string,
    recipe: (typeof BUILT_IN_AUTOMATION_RECIPES)[number],
  ) {
    return {
      tenantId,
      name: recipe.name,
      trigger: recipe.trigger,
      conditions: recipeConditionsWithKey(
        recipe.recipeKey,
        recipe.conditions as Record<string, unknown>,
      ) as Prisma.InputJsonValue,
      actions: recipe.actions as Prisma.InputJsonValue,
      isEnabled: true,
    };
  }

  private async findBuiltInRule(
    tenantId: string,
    recipeKey: string,
    recipe: (typeof BUILT_IN_AUTOMATION_RECIPES)[number],
  ) {
    const rules = await this.prisma.automationRule.findMany({
      where: { tenantId },
    });

    return (
      rules.find((rule) => extractRecipeKey(rule.conditions) === recipeKey) ??
      rules.find(
        (rule) => rule.name === recipe.name && rule.trigger === recipe.trigger,
      )
    );
  }
}
