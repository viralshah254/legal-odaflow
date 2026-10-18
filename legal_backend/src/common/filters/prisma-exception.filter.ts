import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainErrorCode } from '../errors/domain-errors';
import { LegalRequestContext } from '../types/legal-request-context';

interface RequestWithContext {
  legalContext?: LegalRequestContext;
  headers: Record<string, string | string[] | undefined>;
}

interface OutgoingResponse {
  status(code: number): OutgoingResponse;
  json(body: unknown): void;
}

function extractRequestId(req: RequestWithContext): string | undefined {
  if (req.legalContext?.requestId) return req.legalContext.requestId;
  const header = req.headers['x-request-id'];
  if (Array.isArray(header)) return header[0];
  return header;
}

function isDbConnectivityError(message: string): boolean {
  return (
    message.includes("Can't reach database") ||
    message.includes('P1001') ||
    message.includes('Connection refused') ||
    message.includes('ETIMEDOUT')
  );
}

function isRetryableDbTimeoutError(message: string, code?: string): boolean {
  if (code === 'P1008' || code === 'P1017' || code === 'P2024') return true;
  return (
    message.includes('P1008') ||
    message.includes('P1017') ||
    message.includes('P2024') ||
    message.includes('Timed out') ||
    message.includes('timeout') ||
    message.includes('connection pool')
  );
}

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientRustPanicError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientUnknownRequestError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<OutgoingResponse>();
    const request = ctx.getRequest<RequestWithContext>();
    const requestId = extractRequestId(request);
    const message = exception.message ?? '';

    if (isDbConnectivityError(message)) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: {
          code: 'DB_UNAVAILABLE',
          message: 'Database is waking up — please retry in a few seconds.',
          details: {},
          retryable: true,
          requestId,
        },
      });
      return;
    }

    const prismaCode =
      exception instanceof Prisma.PrismaClientKnownRequestError ? exception.code : undefined;
    if (isRetryableDbTimeoutError(message, prismaCode)) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: {
          code: 'DB_TIMEOUT',
          message: 'Database is busy — please retry in a few seconds.',
          details: {},
          retryable: true,
          requestId,
        },
      });
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') {
        response.status(HttpStatus.NOT_FOUND).json({
          error: {
            code: DomainErrorCode.NOT_FOUND,
            message: 'The requested record was not found.',
            details: {},
            retryable: false,
            requestId,
          },
        });
        return;
      }

      if (exception.code === 'P2002') {
        response.status(HttpStatus.CONFLICT).json({
          error: {
            code: DomainErrorCode.CONFLICT,
            message: 'A record with the provided value already exists.',
            details: {},
            retryable: false,
            requestId,
          },
        });
        return;
      }
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'DB_ERROR',
        message: 'An unexpected database error occurred.',
        details: {},
        retryable: false,
        requestId,
      },
    });
  }
}
