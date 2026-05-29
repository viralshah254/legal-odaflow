import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export interface AiPolicySettings {
  disclaimerRequired: boolean;
  citationGuardrails: boolean;
  trainingOptOut: boolean;
  requireLawyerApproval: boolean;
}

export interface GovernanceSettings {
  ethicalWallsEnabled: boolean;
  dataRetentionDays: number;
  aiTrainingOptOut: boolean;
  requireMatterApprovalForSharing: boolean;
  copilotPolicy: string;
  aiPolicy?: AiPolicySettings;
  updatedAt?: string;
}

const DEFAULT_AI_POLICY: AiPolicySettings = {
  disclaimerRequired: true,
  citationGuardrails: true,
  trainingOptOut: true,
  requireLawyerApproval: true,
};

const DEFAULT_GOVERNANCE_SETTINGS: GovernanceSettings = {
  ethicalWallsEnabled: false,
  dataRetentionDays: 2555,
  aiTrainingOptOut: true,
  requireMatterApprovalForSharing: true,
  copilotPolicy: 'REQUIRE_CITATIONS',
  aiPolicy: { ...DEFAULT_AI_POLICY },
};

@Injectable()
export class GovernanceSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private parseSettings(raw: unknown): GovernanceSettings {
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_GOVERNANCE_SETTINGS };
    }

    const settings = raw as Partial<GovernanceSettings>;
    return {
      ethicalWallsEnabled:
        settings.ethicalWallsEnabled ?? DEFAULT_GOVERNANCE_SETTINGS.ethicalWallsEnabled,
      dataRetentionDays:
        settings.dataRetentionDays ?? DEFAULT_GOVERNANCE_SETTINGS.dataRetentionDays,
      aiTrainingOptOut:
        settings.aiTrainingOptOut ?? DEFAULT_GOVERNANCE_SETTINGS.aiTrainingOptOut,
      requireMatterApprovalForSharing:
        settings.requireMatterApprovalForSharing ??
        DEFAULT_GOVERNANCE_SETTINGS.requireMatterApprovalForSharing,
      copilotPolicy: settings.copilotPolicy ?? DEFAULT_GOVERNANCE_SETTINGS.copilotPolicy,
      aiPolicy: {
        ...DEFAULT_AI_POLICY,
        ...(settings.aiPolicy ?? {}),
      },
      updatedAt: settings.updatedAt,
    };
  }

  async getSettings(tenantId: string): Promise<GovernanceSettings> {
    const profile = await this.prisma.firmProfile.findUnique({ where: { tenantId } });
    const settings = this.parseSettings(
      (profile?.settings as { governance?: GovernanceSettings } | null)?.governance,
    );
    return settings;
  }

  async updateSettings(
    tenantId: string,
    patch: Partial<GovernanceSettings>,
  ): Promise<GovernanceSettings> {
    const current = await this.getSettings(tenantId);
    const next: GovernanceSettings = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    const existingProfile = await this.prisma.firmProfile.findUnique({ where: { tenantId } });
    const existingSettings =
      (existingProfile?.settings as Record<string, unknown> | null) ?? {};

    await this.prisma.firmProfile.upsert({
      where: { tenantId },
      create: {
        tenantId,
        settings: {
          ...existingSettings,
          governance: next,
        } as unknown as Prisma.InputJsonValue,
      },
      update: {
        settings: {
          ...existingSettings,
          governance: next,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return next;
  }
}
