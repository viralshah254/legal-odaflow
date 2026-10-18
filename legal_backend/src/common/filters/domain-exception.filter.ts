import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { DomainError, DomainErrorCode } from '../errors/domain-errors';
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

@Catch(DomainError, HttpException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError | HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<OutgoingResponse>();
    const request = ctx.getRequest<RequestWithContext>();

    const requestId = extractRequestId(request);

    if (exception instanceof DomainError) {
      response.status(exception.statusCode).json({
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details ?? {},
          retryable: exception.retryable,
          requestId,
        },
      });
      return;
    }

    // HttpException
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message: string;
    let details: Record<string, unknown> = {};

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as Record<string, unknown>;
      message = typeof resp['message'] === 'string'
        ? resp['message']
        : Array.isArray(resp['message'])
          ? (resp['message'] as string[]).join('; ')
          : exception.message;
      const { message: _msg, statusCode: _sc, error: _err, ...rest } = resp;
      void _msg; void _sc; void _err;
      details = rest;
    } else {
      message = exception.message;
    }

    const code = httpStatusToDomainCode(status);

    response.status(status).json({
      error: {
        code,
        message,
        details,
        retryable: status >= 500 && status !== 501,
        requestId,
      },
    });
  }
}

function httpStatusToDomainCode(status: number): string {
  switch (status) {
    case HttpStatus.NOT_FOUND:
      return DomainErrorCode.NOT_FOUND;
    case HttpStatus.FORBIDDEN:
      return DomainErrorCode.FORBIDDEN;
    case HttpStatus.CONFLICT:
      return DomainErrorCode.CONFLICT;
    case HttpStatus.TOO_MANY_REQUESTS:
      return DomainErrorCode.RATE_LIMITED;
    case HttpStatus.UNPROCESSABLE_ENTITY:
    case HttpStatus.BAD_REQUEST:
      return DomainErrorCode.VALIDATION_FAILED;
    default:
      return `HTTP_${status}`;
  }
}
