import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateAccessPolicyDto,
  CreateDocumentPolicyDto,
  UpdateGovernancePoliciesDto,
} from './dto/governance.dto';
import {
  DEFAULT_GOVERNANCE_SETTINGS,
  GovernanceSettings,
  UpdateGovernanceSettingsDto,
} from './dto/governance-settings.dto';

@Injectable()
export class GovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getPolicies(tenantId: string) {
    await this.ensureTenant(tenantId);

    const [documentPolicies, accessPolicies, firmProfile] = await Promise.all([
      this.prisma.documentPolicy.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.accessPolicy.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.firmProfile.findUnique({ where: { tenantId } }),
    ]);

    return { documentPolicies, accessPolicies, firmProfile };
  }

  async updatePolicies(tenantId: string, dto: UpdateGovernancePoliciesDto) {
    await this.ensureTenant(tenantId);

    const results: {
      documentPolicies: unknown[];
      accessPolicies: unknown[];
      firmProfile: unknown | null;
    } = {
      documentPolicies: [],
      accessPolicies: [],
      firmProfile: null,
    };

    if (dto.documentPolicies?.length) {
      results.documentPolicies = await Promise.all(
        dto.documentPolicies.map((policy) => {
          if (policy.id) {
            return this.prisma.documentPolicy.update({
              where: { id: policy.id },
              data: {
                name: policy.name,
                retentionDays: policy.retentionDays,
                defaultVisibility: policy.defaultVisibility,
                rules: policy.rules as Prisma.InputJsonValue | undefined,
                isActive: policy.isActive,
              },
            });
          }

          return this.prisma.documentPolicy.create({
            data: {
              tenantId,
              name: policy.name ?? 'Untitled Policy',
              retentionDays: policy.retentionDays,
              defaultVisibility: policy.defaultVisibility ?? 'PRIVATE',
              rules: policy.rules as Prisma.InputJsonValue | undefined,
              isActive: policy.isActive ?? true,
            },
          });
        }),
      );
    }

    if (dto.accessPolicies?.length) {
      results.accessPolicies = await Promise.all(
        dto.accessPolicies.map((policy) => {
          if (policy.id) {
            return this.prisma.accessPolicy.update({
              where: { id: policy.id },
              data: {
                name: policy.name,
                description: policy.description,
                rules: policy.rules as Prisma.InputJsonValue | undefined,
                isActive: policy.isActive,
              },
            });
          }

          return this.prisma.accessPolicy.create({
            data: {
              tenantId,
              name: policy.name ?? 'Untitled Access Policy',
              description: policy.description,
              rules: policy.rules as Prisma.InputJsonValue | undefined,
              isActive: policy.isActive ?? true,
            },
          });
        }),
      );
    }

    if (dto.firmProfile) {
      results.firmProfile = await this.prisma.firmProfile.upsert({
        where: { tenantId },
        create: {
          tenantId,
          displayName: dto.firmProfile.displayName,
          logoUrl: dto.firmProfile.logoUrl,
          address: dto.firmProfile.address,
          settings: dto.firmProfile.settings as Prisma.InputJsonValue | undefined,
        },
        update: {
          displayName: dto.firmProfile.displayName,
          logoUrl: dto.firmProfile.logoUrl,
          address: dto.firmProfile.address,
          settings: dto.firmProfile.settings as Prisma.InputJsonValue | undefined,
        },
      });
    }

    return results;
  }

  async createDocumentPolicy(tenantId: string, dto: CreateDocumentPolicyDto) {
    await this.ensureTenant(tenantId);

    return this.prisma.documentPolicy.create({
      data: {
        tenantId,
        name: dto.name,
        retentionDays: dto.retentionDays,
        defaultVisibility: dto.defaultVisibility ?? 'PRIVATE',
        rules: dto.rules as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async createAccessPolicy(tenantId: string, dto: CreateAccessPolicyDto) {
    await this.ensureTenant(tenantId);

    return this.prisma.accessPolicy.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        rules: dto.rules as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async getSettings(tenantId: string): Promise<GovernanceSettings> {
    await this.ensureTenant(tenantId);

    const firmProfile = await this.prisma.firmProfile.findUnique({
      where: { tenantId },
    });

    return this.mergeSettings(firmProfile?.settings, firmProfile?.updatedAt);
  }

  async updateSettings(
    tenantId: string,
    dto: UpdateGovernanceSettingsDto,
  ): Promise<GovernanceSettings> {
    await this.ensureTenant(tenantId);

    const existing = await this.getSettings(tenantId);
    const merged: GovernanceSettings = {
      ...existing,
      ...dto,
    };

    const firmProfile = await this.prisma.firmProfile.upsert({
      where: { tenantId },
      create: {
        tenantId,
        settings: merged as unknown as Prisma.InputJsonValue,
      },
      update: {
        settings: merged as unknown as Prisma.InputJsonValue,
      },
    });

    return this.mergeSettings(firmProfile.settings, firmProfile.updatedAt);
  }

  private mergeSettings(
    settings: Prisma.JsonValue | null | undefined,
    updatedAt?: Date,
  ): GovernanceSettings {
    const stored =
      settings && typeof settings === 'object' && !Array.isArray(settings)
        ? (settings as Record<string, unknown>)
        : {};

    return {
      ethicalWallsEnabled:
        typeof stored.ethicalWallsEnabled === 'boolean'
          ? stored.ethicalWallsEnabled
          : DEFAULT_GOVERNANCE_SETTINGS.ethicalWallsEnabled,
      dataRetentionDays:
        typeof stored.dataRetentionDays === 'number'
          ? stored.dataRetentionDays
          : DEFAULT_GOVERNANCE_SETTINGS.dataRetentionDays,
      aiTrainingOptOut:
        typeof stored.aiTrainingOptOut === 'boolean'
          ? stored.aiTrainingOptOut
          : DEFAULT_GOVERNANCE_SETTINGS.aiTrainingOptOut,
      requireMatterApprovalForSharing:
        typeof stored.requireMatterApprovalForSharing === 'boolean'
          ? stored.requireMatterApprovalForSharing
          : DEFAULT_GOVERNANCE_SETTINGS.requireMatterApprovalForSharing,
      copilotPolicy:
        typeof stored.copilotPolicy === 'string'
          ? stored.copilotPolicy
          : DEFAULT_GOVERNANCE_SETTINGS.copilotPolicy,
      updatedAt: updatedAt?.toISOString(),
    };
  }

  private async ensureTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
  }
}
