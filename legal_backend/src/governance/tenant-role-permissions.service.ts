import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export type FlatRolePermissionKey =
  | 'canViewAllMatters'
  | 'canViewTeam'
  | 'canViewFinance'
  | 'canCreateMatter'
  | 'canAssignTasks'
  | 'canViewAllTasks'
  | 'canViewAllCalendar'
  | 'canManageSettings'
  | 'canApproveTrust';

export type TenantRolePermissionsMap = Record<string, Record<FlatRolePermissionKey, boolean>>;

const DEFAULT_ROLE_PERMISSIONS: TenantRolePermissionsMap = {
  PARTNER_ADMIN: {
    canViewAllMatters: true,
    canViewTeam: true,
    canViewFinance: true,
    canCreateMatter: true,
    canAssignTasks: true,
    canViewAllTasks: true,
    canViewAllCalendar: true,
    canManageSettings: true,
    canApproveTrust: true,
  },
  JUNIOR_PARTNER: {
    canViewAllMatters: true,
    canViewTeam: true,
    canViewFinance: false,
    canCreateMatter: true,
    canAssignTasks: true,
    canViewAllTasks: true,
    canViewAllCalendar: true,
    canManageSettings: false,
    canApproveTrust: false,
  },
  ASSOCIATE: {
    canViewAllMatters: false,
    canViewTeam: true,
    canViewFinance: false,
    canCreateMatter: true,
    canAssignTasks: false,
    canViewAllTasks: false,
    canViewAllCalendar: false,
    canManageSettings: false,
    canApproveTrust: false,
  },
  PARALEGAL: {
    canViewAllMatters: false,
    canViewTeam: true,
    canViewFinance: false,
    canCreateMatter: false,
    canAssignTasks: false,
    canViewAllTasks: true,
    canViewAllCalendar: true,
    canManageSettings: false,
    canApproveTrust: false,
  },
  FINANCE: {
    canViewAllMatters: true,
    canViewTeam: false,
    canViewFinance: true,
    canCreateMatter: false,
    canAssignTasks: false,
    canViewAllTasks: false,
    canViewAllCalendar: false,
    canManageSettings: false,
    canApproveTrust: true,
  },
  INTAKE: {
    canViewAllMatters: true,
    canViewTeam: false,
    canViewFinance: false,
    canCreateMatter: true,
    canAssignTasks: false,
    canViewAllTasks: true,
    canViewAllCalendar: true,
    canManageSettings: false,
    canApproveTrust: false,
  },
  OPS_HR: {
    canViewAllMatters: false,
    canViewTeam: true,
    canViewFinance: false,
    canCreateMatter: false,
    canAssignTasks: false,
    canViewAllTasks: false,
    canViewAllCalendar: true,
    canManageSettings: true,
    canApproveTrust: false,
  },
  RECEPTION: {
    canViewAllMatters: false,
    canViewTeam: false,
    canViewFinance: false,
    canCreateMatter: false,
    canAssignTasks: false,
    canViewAllTasks: false,
    canViewAllCalendar: true,
    canManageSettings: false,
    canApproveTrust: false,
  },
  READ_ONLY: {
    canViewAllMatters: true,
    canViewTeam: true,
    canViewFinance: false,
    canCreateMatter: false,
    canAssignTasks: false,
    canViewAllTasks: true,
    canViewAllCalendar: true,
    canManageSettings: false,
    canApproveTrust: false,
  },
};

@Injectable()
export class TenantRolePermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  private parseStored(raw: unknown): TenantRolePermissionsMap {
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_ROLE_PERMISSIONS };
    }
    const stored = raw as TenantRolePermissionsMap;
    const merged: TenantRolePermissionsMap = { ...DEFAULT_ROLE_PERMISSIONS };
    for (const role of Object.keys(merged)) {
      if (stored[role]) {
        merged[role] = { ...merged[role], ...stored[role] };
      }
    }
    return merged;
  }

  async getPermissions(tenantId: string): Promise<TenantRolePermissionsMap> {
    const profile = await this.prisma.firmProfile.findUnique({ where: { tenantId } });
    const settings = profile?.settings as { rolePermissions?: unknown } | null;
    return this.parseStored(settings?.rolePermissions);
  }

  async updatePermissions(
    tenantId: string,
    patch: TenantRolePermissionsMap,
  ): Promise<TenantRolePermissionsMap> {
    const current = await this.getPermissions(tenantId);
    const next: TenantRolePermissionsMap = { ...current };

    for (const [role, perms] of Object.entries(patch)) {
      if (role === 'PARTNER_ADMIN') continue;
      if (next[role]) {
        next[role] = { ...next[role], ...perms };
      }
    }

    const existingProfile = await this.prisma.firmProfile.findUnique({ where: { tenantId } });
    const existingSettings =
      (existingProfile?.settings as Record<string, unknown> | null) ?? {};

    await this.prisma.firmProfile.upsert({
      where: { tenantId },
      create: {
        tenantId,
        settings: {
          ...existingSettings,
          rolePermissions: next,
          rolePermissionsUpdatedAt: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
      update: {
        settings: {
          ...existingSettings,
          rolePermissions: next,
          rolePermissionsUpdatedAt: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: 'ROLE_PERMISSIONS_UPDATED',
        entityType: 'FirmProfile',
        entityId: tenantId,
        metadata: { roles: Object.keys(patch) } as Prisma.InputJsonValue,
      },
    });

    return next;
  }

  async hasPermission(
    tenantId: string,
    role: string | undefined,
    permission: FlatRolePermissionKey,
  ): Promise<boolean> {
    if (!role) return false;
    if (role === 'PARTNER_ADMIN') return true;
    const map = await this.getPermissions(tenantId);
    return map[role]?.[permission] ?? DEFAULT_ROLE_PERMISSIONS[role]?.[permission] ?? false;
  }
}
