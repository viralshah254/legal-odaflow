import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { RequestUser } from '../types/request-user.interface';
import { LegalRequestContext, LegalFeature, RiskLevel } from '../types/legal-request-context';
import { logger } from '../observability/logger';

interface IncomingRequest {
  method: string;
  url: string;
  route?: { path?: string };
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  user?: RequestUser;
  legalContext?: LegalRequestContext;
}

interface OutgoingResponse {
  setHeader(name: string, value: string): void;
  statusCode: number;
}

function extractHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

function inferFeature(url: string): LegalFeature {
  if (url.includes('/research')) return 'research';
  if (url.includes('/draft')) return 'drafting';
  if (url.includes('/issue-analysis') || url.includes('/issue_analysis')) return 'issue_analysis';
  if (url.includes('/document-review') || url.includes('/document_review')) return 'document_review';
  if (url.includes('/contract-review') || url.includes('/contract_review')) return 'contract_review';
  if (url.includes('/matter-intelligence') || url.includes('/matter_intelligence')) return 'matter_intelligence';
  if (url.includes('/strategy')) return 'strategy';
  if (url.includes('/hearing-prep') || url.includes('/hearing_prep')) return 'hearing_prep';
  if (url.includes('/negotiation')) return 'negotiation';
  if (url.includes('/verification')) return 'verification';
  if (url.includes('/copilot')) return 'copilot';
  return 'copilot';
}

function inferRiskLevel(feature: LegalFeature): RiskLevel {
  const high: LegalFeature[] = ['strategy', 'hearing_prep', 'negotiation'];
  const medium: LegalFeature[] = ['drafting', 'contract_review', 'document_review', 'verification'];
  if (high.includes(feature)) return 'high';
  if (medium.includes(feature)) return 'medium';
  return 'low';
}

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<IncomingRequest>();
    const response = context.switchToHttp().getResponse<OutgoingResponse>();

    const existingRequestId = extractHeader(request.headers, 'x-request-id');
    const requestId = existingRequestId ?? `req_${uuidv4()}`;

    const user = request.user;
    const tenantId = user?.tenantId ?? extractHeader(request.headers, 'x-tenant-id') ?? 'unknown';
    const userId = user?.id ?? 'anonymous';

    const locale =
      extractHeader(request.headers, 'accept-language')?.split(',')[0]?.split(';')[0]?.trim() ?? 'en';
    const timezone = extractHeader(request.headers, 'x-timezone') ?? 'UTC';
    const jurisdictionCode = extractHeader(request.headers, 'x-jurisdiction-code');
    const matterId = extractHeader(request.headers, 'x-matter-id');
    const clientId = extractHeader(request.headers, 'x-client-id');
    const sessionId = extractHeader(request.headers, 'x-session-id');

    const url = request.url ?? '';
    const feature = inferFeature(url);
    const riskLevel = inferRiskLevel(feature);

    const legalContext: LegalRequestContext = {
      requestId,
      tenantId,
      userId,
      userRole: user?.tenantRole,
      locale,
      timezone,
      countryCode: user?.countryCode ?? undefined,
      jurisdictionCode,
      matterId,
      clientId,
      feature,
      riskLevel,
      ipAddress: request.ip,
      userAgent: extractHeader(request.headers, 'user-agent'),
      sessionId,
    };

    request.legalContext = legalContext;
    response.setHeader('X-Request-Id', requestId);

    const startedAt = Date.now();
    const method = request.method;
    const path = request.route?.path ?? url;

    logger.info('request.started', { requestId, tenantId, userId, method, path });

    return next.handle().pipe(
      tap({
        next: () => {
          logger.info('request.completed', {
            event: 'request.completed',
            requestId,
            tenantId,
            userId,
            method,
            path,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
          });
        },
        error: (err: unknown) => {
          const statusCode =
            typeof err === 'object' && err !== null && 'status' in err
              ? (err as { status: number }).status
              : 500;
          logger.info('request.completed', {
            event: 'request.completed',
            requestId,
            tenantId,
            userId,
            method,
            path,
            statusCode,
            durationMs: Date.now() - startedAt,
          });
        },
      }),
    );
  }
}
