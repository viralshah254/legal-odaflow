// IdempotencyMiddleware
//
// Provides idempotent request handling via the `Idempotency-Key` header.
// Only applies to state-mutating requests (POST, PUT, PATCH).
//
// HOW TO REGISTER (do NOT register globally):
//
//   Register selectively on expensive or non-idempotent routes only:
//     - POST /workflows                   -- workflow creation
//     - POST /ai-credits/debit            -- credit debit
//     - POST /export                      -- document export
//     - POST /legal-forms/:id/finalise    -- document finalisation
//     - POST /notifications/email         -- email send
//     - POST /payments/intents            -- payment intent creation
//
//   In a feature module (e.g. WorkflowsModule):
//
//     export class WorkflowsModule implements NestModule {
//       configure(consumer: MiddlewareConsumer) {
//         consumer
//           .apply(IdempotencyMiddleware)
//           .forRoutes({ path: 'workflows', method: RequestMethod.POST });
//       }
//     }
//
// BEHAVIOUR:
//   1. No Idempotency-Key header  -> pass through (middleware is a no-op).
//   2. Key exists, status=processing -> 409 IDEMPOTENCY_CONFLICT.
//   3. Key exists, status=completed  -> return cached response immediately.
//   4. Key exists, status=failed     -> re-run (treat as new request).
//   5. Key not found                 -> create record (processing), run request,
//                                       save response body + status, mark completed.

import {
  Injectable,
  NestMiddleware,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { DomainError, DomainErrorCode } from '@/common/errors/domain-errors';

const SKIP_METHODS = new Set(['GET', 'DELETE', 'OPTIONS', 'HEAD']);
const IDEMPOTENCY_TTL_HOURS = 24;
const HEADER_KEY = 'idempotency-key';

interface RequestWithUser extends Request {
  user?: { id: string; tenantId?: string };
  tenantId?: string;
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IdempotencyMiddleware.name);

  constructor(private readonly prisma: PrismaService) {}

  async use(req: RequestWithUser, res: Response, next: NextFunction): Promise<void> {
    // Only process state-mutating requests that carry the header
    if (SKIP_METHODS.has(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers[HEADER_KEY];
    if (!idempotencyKey) {
      return next();
    }

    const key = Array.isArray(idempotencyKey) ? idempotencyKey[0] : idempotencyKey;

    const tenantId = req.tenantId ?? req.user?.tenantId;
    if (!tenantId) {
      // Cannot enforce idempotency without a tenant scope – pass through
      return next();
    }

    const route = `${req.method}:${req.route?.path ?? req.path}`;
    const requestHash = this.hashRequest(req);

    try {
      const existing = await this.prisma.idempotencyRecord.findUnique({
        where: { tenantId_key: { tenantId, key } },
      });

      if (existing) {
        if (existing.status === 'processing') {
          // A concurrent request with the same key is in flight
          const error = new DomainError(
            DomainErrorCode.IDEMPOTENCY_CONFLICT,
            'A request with this Idempotency-Key is already being processed. Retry after it completes.',
            409,
            { key, tenantId },
          );
          res.status(409).json({
            error: {
              code: error.code,
              message: error.message,
              details: error.details ?? {},
              retryable: false,
            },
          });
          return;
        }

        if (existing.status === 'completed' && existing.responseRef) {
          // Replay the cached response
          try {
            const cached = JSON.parse(existing.responseRef) as {
              statusCode: number;
              body: unknown;
            };
            res
              .status(cached.statusCode ?? existing.statusCode ?? 200)
              .set('X-Idempotency-Replayed', 'true')
              .json(cached.body);
            return;
          } catch {
            this.logger.warn(`IdempotencyMiddleware: failed to parse cached response for key ${key}`);
            // Fall through and re-execute
          }
        }

        // status=failed or corrupt cache: treat as new, clean up old record
        await this.prisma.idempotencyRecord.delete({
          where: { id: existing.id },
        }).catch(() => undefined);
      }

      // Create a processing record
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS);

      const record = await this.prisma.idempotencyRecord.create({
        data: {
          key,
          tenantId,
          route,
          requestHash,
          status: 'processing',
          expiresAt,
        },
      });

      // Intercept the response to save it
      const originalJson = res.json.bind(res);
      const originalStatus = res.status.bind(res);
      let capturedStatus = 200;

      res.status = (code: number) => {
        capturedStatus = code;
        return originalStatus(code);
      };

      res.json = (body: unknown) => {
        // Persist response asynchronously; don't block the caller
        this.saveResponse(record.id, capturedStatus, body).catch((err) => {
          this.logger.error(
            `IdempotencyMiddleware: failed to save response for key ${key}: ${(err as Error).message}`,
          );
        });
        return originalJson(body);
      };

      return next();
    } catch (err) {
      this.logger.error(`IdempotencyMiddleware error: ${(err as Error).message}`);
      // On unexpected errors, pass through rather than blocking the request
      return next();
    }
  }

  private async saveResponse(
    recordId: string,
    statusCode: number,
    body: unknown,
  ): Promise<void> {
    await this.prisma.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        status: statusCode >= 200 && statusCode < 300 ? 'completed' : 'failed',
        statusCode,
        responseRef: JSON.stringify({ statusCode, body }),
      },
    });
  }

  private hashRequest(req: Request): string {
    const data = JSON.stringify({
      method: req.method,
      path: req.path,
      body: req.body,
    });
    return createHash('sha256').update(data).digest('hex');
  }
}
