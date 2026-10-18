import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  PrivacyAssessment,
  PrivacyAssessmentStatus,
  normalizePrivacyAssessment,
} from '@/country-compliance/privacy-controls';
import { PrivacyControlsService } from '@/country-compliance/privacy-controls.service';
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
  privacyAssessment: PrivacyAssessment;
  privacyStatus?: PrivacyAssessmentStatus;
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
  privacyAssessment: normalizePrivacyAssessment(undefined),
};

@Injectable()
export class GovernanceSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly privacyControls: PrivacyControlsService,
  ) {}

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
      privacyAssessment: normalizePrivacyAssessment(settings.privacyAssessment),
      updatedAt: settings.updatedAt,
    };
  }

  async getSettings(tenantId: string): Promise<GovernanceSettings> {
    const profile = await this.prisma.firmProfile.findUnique({ where: { tenantId } });
    const root = profile?.settings as
      | (Partial<GovernanceSettings> & { governance?: GovernanceSettings })
      | null;
    const settings = this.parseSettings(root?.governance ?? root);
    const { status } = await this.privacyControls.getTenantAssessment(tenantId);
    return { ...settings, privacyStatus: status };
  }

  async updateSettings(
    tenantId: string,
    patch: Partial<GovernanceSettings>,
    actorUserId?: string,
  ): Promise<GovernanceSettings> {
    const current = await this.getSettings(tenantId);
    const {
      privacyStatus: _ignoredPatchStatus,
      privacyAssessment: patchAssessment,
      ...safePatch
    } = patch;
    const privacyAssessment = patchAssessment
      ? this.privacyControls.stampAssessment(
          patchAssessment,
          actorUserId,
        )
      : current.privacyAssessment;
    const { privacyStatus: _ignoredStatus, ...persistedCurrent } = current;
    const next: GovernanceSettings = {
      ...persistedCurrent,
      ...safePatch,
      privacyAssessment,
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

    return this.getSettings(tenantId);
  }
}
