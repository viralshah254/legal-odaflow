import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export type AuditCategory =
  | 'access'
  | 'export'
  | 'permission_change'
  | 'workflow_started'
  | 'workflow_completed'
  | 'deletion'
  | 'admin_change'
  | 'security_event'
  | 'billing_event'
  | 'matter_access'
  | 'document_access'
  | 'ai_generation'
  | 'verification_override'
  | 'ethical_wall_attempt';

export interface AuditEventInput {
  tenantId: string;
  userId: string;
  category: AuditCategory;
  action: string;
  resourceType?: string;
  resourceId?: string;
  matterId?: string;
  workflowId?: string;
  requestId?: string;
  outcome: 'success' | 'failure' | 'blocked';
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditEventService {
  private readonly logger = new Logger(AuditEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditEventInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId,
          tenantId: input.tenantId,
          action: input.action,
          entityType: input.resourceType ?? input.category,
          entityId: input.resourceId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: {
            category: input.category,
            outcome: input.outcome,
            ...(input.matterId ? { matterId: input.matterId } : {}),
            ...(input.workflowId ? { workflowId: input.workflowId } : {}),
            ...(input.requestId ? { requestId: input.requestId } : {}),
            ...(input.details ?? {}),
          },
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to record audit event: ${input.action}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
