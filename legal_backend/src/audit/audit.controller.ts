import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { TenantPermission } from '@/common/decorators/tenant-permission.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantPermissionGuard } from '@/common/guards/tenant-permission.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(TenantGuard, TenantPermissionGuard)
@TenantPermission('canManageSettings')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  findLogs(
    @TenantId() tenantId: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.auditService.findLogs({
      tenantId,
      userId,
      action,
      entityType,
      entityId,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  /**
   * GET /audit/logs/export
   * Download all audit logs as CSV (SOC 2 evidence export).
   * PARTNER_ADMIN only (enforced by TenantGuard role check in calling patterns).
   */
  @Get('logs/export')
  async exportLogs(
    @TenantId() tenantId: string,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const result = await this.auditService.findLogs({
      tenantId,
      from,
      to,
      limit: 10000,
      offset: 0,
    });

    const headers = ['timestamp', 'userId', 'action', 'entityType', 'entityId', 'ipAddress', 'userAgent'];
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const lines = [
      headers.join(','),
      ...result.items.map((log) =>
        [
          escape(log.createdAt?.toISOString()),
          escape(log.userId),
          escape(log.action),
          escape(log.entityType),
          escape(log.entityId),
          escape(log.ipAddress),
          escape(log.userAgent),
        ].join(','),
      ),
    ];

    const csv = lines.join('\n');
    const filename = `audit-logs-${tenantId}-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
