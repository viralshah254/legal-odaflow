import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, tap } from 'rxjs';
import { AuditService } from '@/audit/audit.service';
import { RequestUser } from '../types/request-user.interface';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const enabled = this.configService.get<string>('ENABLE_AUDIT_LOGS', 'true') === 'true';

    if (!enabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      method: string;
      route?: { path?: string };
      url: string;
      user?: RequestUser;
      tenantId?: string;
      headers: Record<string, string | string[] | undefined>;
      params: Record<string, string>;
      ip?: string;
    }>();

    const user = request.user;
    const tenantId = request.tenantId ?? user?.tenantId;
    const action = `${request.method} ${request.route?.path ?? request.url}`;

    return next.handle().pipe(
      tap(async () => {
        await this.auditService.log({
          userId: user?.id,
          tenantId,
          action,
          entityType: 'HTTP_REQUEST',
          entityId: request.params.id ?? request.params.matterId ?? request.params.caseId,
          ipAddress: request.ip,
          userAgent: this.extractUserAgent(request.headers['user-agent']),
          metadata: {
            method: request.method,
            path: request.route?.path ?? request.url,
          },
        });
      }),
    );
  }

  private extractUserAgent(
    userAgent: string | string[] | undefined,
  ): string | undefined {
    if (Array.isArray(userAgent)) {
      return userAgent[0];
    }

    return userAgent;
  }
}
