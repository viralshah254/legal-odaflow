import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  url?: string;
}

interface ResponseLike {
  status(code: number): ResponseLike;
  json(body: unknown): void;
}

/**
 * Catch-all fallback for raw Error/TypeError objects that slip past
 * DomainExceptionFilter and PrismaExceptionFilter.
 *
 * Logs the full stack trace so it appears in the backend terminal, then
 * returns a structured { error: { message, code } } response consistent
 * with the rest of the API — instead of NestJS's opaque default
 * { "statusCode": 500, "message": "Internal Server Error" }.
 *
 * Registration order in main.ts matters: this filter must be registered
 * FIRST so it has the lowest priority. Specific filters registered after
 * it (DomainExceptionFilter, PrismaExceptionFilter) take precedence for
 * the exception types they declare in @Catch().
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<ResponseLike>();
    const request = ctx.getRequest<RequestLike>();

    const err = exception instanceof Error ? exception : new Error(String(exception));

    const headerValue = request?.headers?.['x-request-id'];
    const requestId = Array.isArray(headerValue) ? headerValue[0] : (headerValue ?? undefined);

    this.logger.error(
      `Unhandled exception [${request?.method ?? '?'} ${request?.url ?? '?'}] requestId=${requestId ?? 'none'}: ${err.message}`,
      err.stack,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again.',
        retryable: true,
        requestId,
      },
    });
  }
}
