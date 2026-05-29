import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class GdprService {
  constructor(private readonly prisma: PrismaService) {}

  async exportUserData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        consumerProfile: true,
        consumerCases: {
          include: {
            documents: true,
            reports: true,
            reviewRequests: true,
          },
        },
        consumerDocuments: true,
        consumerReports: true,
        trainingConsents: true,
        aiOutputs: { take: 100, orderBy: { createdAt: 'desc' } },
        aiUsageLogs: { take: 100, orderBy: { createdAt: 'desc' } },
        aiCreditLedger: { take: 200, orderBy: { createdAt: 'desc' } },
        lawyerLeads: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const payments = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const { passwordHash: _removed, ...safeUser } = user;

    return {
      exportedAt: new Date().toISOString(),
      subjectType: 'user',
      subjectId: userId,
      data: { ...safeUser, payments },
    };
  }

  async deleteUserData(userId: string, confirmEmail: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.email.toLowerCase() !== confirmEmail.toLowerCase()) {
      throw new ForbiddenException('Email confirmation does not match account');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.aICreditLedger.deleteMany({ where: { userId } });
      await tx.aIUsageLog.deleteMany({ where: { userId } });
      await tx.aIOutput.deleteMany({ where: { userId } });
      await tx.payment.deleteMany({ where: { userId } });
      await tx.lawyerLead.deleteMany({ where: { userId } });
      await tx.trainingConsent.deleteMany({ where: { userId } });
      await tx.consumerDocument.deleteMany({ where: { userId } });
      await tx.consumerLegalReport.deleteMany({ where: { userId } });
      await tx.consumerCase.deleteMany({ where: { userId } });
      await tx.consumerProfile.deleteMany({ where: { userId } });
      await tx.lawyerProfile.deleteMany({ where: { userId } });
      await tx.tenantUser.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted_${userId}@anonymized.local`,
          name: 'Deleted User',
          phone: null,
          passwordHash: null,
          isActive: false,
        },
      });
    });

    return {
      deleted: true,
      subjectType: 'user',
      subjectId: userId,
      deletedAt: new Date().toISOString(),
    };
  }

  async exportTenantData(tenantId: string, requesterId: string) {
    await this.assertTenantAdmin(tenantId, requesterId);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        tenantUsers: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                userType: true,
                createdAt: true,
              },
            },
          },
        },
        clients: { take: 500 },
        matters: { take: 500 },
        documents: { take: 500 },
        invoices: { take: 200 },
        payments: { take: 200 },
        subscriptions: true,
        aiOutputs: { take: 200, orderBy: { createdAt: 'desc' } },
        aiUsageLogs: { take: 200, orderBy: { createdAt: 'desc' } },
        auditLogs: { take: 500, orderBy: { createdAt: 'desc' } },
        trainingConsents: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      exportedAt: new Date().toISOString(),
      subjectType: 'tenant',
      subjectId: tenantId,
      data: tenant,
    };
  }

  async deleteTenantData(
    tenantId: string,
    requesterId: string,
    confirmTenantName: string,
  ) {
    await this.assertTenantAdmin(tenantId, requesterId);

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.name !== confirmTenantName) {
      throw new ForbiddenException('Tenant name confirmation does not match');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          name: `Deleted Firm ${tenantId.slice(-6)}`,
          isActive: false,
          billingPlan: 'DELETED',
        },
      });
      await tx.matter.updateMany({
        where: { tenantId },
        data: { status: 'ARCHIVED', title: '[GDPR deleted]' },
      });
      await tx.client.updateMany({
        where: { tenantId },
        data: { name: '[GDPR deleted]', email: null, phone: null },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: requesterId,
          action: 'GDPR_TENANT_DELETE',
          entityType: 'Tenant',
          entityId: tenantId,
          metadata: { requestedAt: new Date().toISOString() },
        },
      });
    });

    return {
      deleted: true,
      subjectType: 'tenant',
      subjectId: tenantId,
      deletedAt: new Date().toISOString(),
      note: 'Tenant deactivated and PII redacted. Contact support for full purge if required.',
    };
  }

  private async assertTenantAdmin(tenantId: string, userId: string) {
    const membership = await this.prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('Tenant membership required');
    }

    if (!['FIRM_ADMIN', 'PARTNER'].includes(membership.role)) {
      throw new ForbiddenException('Only firm admins can perform tenant DSAR operations');
    }
  }
}
