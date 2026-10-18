import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { AuditEventService } from './audit-event.service';
import { AUDIT_ACTION_KEY, AuditActionMeta } from './audit-action.decorator';
import { RequestUser } from '@/common/types/request-user.interface';
import { LegalRequestContext } from '@/common/types/legal-request-context';

interface IncomingRequest {
  user?: RequestUser;
  tenantId?: string;
  legalContext?: LegalRequestContext;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string>;
}

@Injectable()
export class AuditActionInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditEventService: AuditEventService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditActionMeta | undefined>(
      AUDIT_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!meta) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<IncomingRequest>();
    const user = request.user;
    const tenantId =
      request.legalContext?.tenantId ??
      request.tenantId ??
      user?.tenantId ??
      'unknown';
    const userId = user?.id ?? 'anonymous';
    const requestId = request.legalContext?.requestId;
    const matterId =
      request.legalContext?.matterId ??
      request.params.matterId ??
      request.params.id;
    const resourceId = request.params.id;

    const userAgent = request.headers['user-agent'];

    return next.handle().pipe(
      tap(() => {
        void this.auditEventService.record({
          tenantId,
          userId,
          category: meta.category,
          action: meta.action,
          resourceId,
          matterId,
          requestId,
          outcome: 'success',
          ipAddress: request.ip,
          userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
        });
      }),
      catchError((err: unknown) => {
        void this.auditEventService.record({
          tenantId,
          userId,
          category: meta.category,
          action: meta.action,
          resourceId,
          matterId,
          requestId,
          outcome: 'failure',
          ipAddress: request.ip,
          userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
          details: {
            errorName: err instanceof Error ? err.name : 'UnknownError',
          },
        });
        return throwError(() => err);
      }),
    );
  }
}
