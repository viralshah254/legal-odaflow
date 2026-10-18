import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { isRateLimitError, parseRetryAfterMs } from '@/ai/llm-retry.util';

@Catch()
export class AiRateLimitExceptionFilter extends BaseExceptionFilter {
  constructor(protected readonly httpAdapterHost: HttpAdapterHost) {
    super(httpAdapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      super.catch(exception, host);
      return;
    }

    const message = exception instanceof Error ? exception.message : String(exception);
    if (isRateLimitError(429, message)) {
      // Return 503 with retryable:true so clients auto-retry without blocking the user.
      // This is a transient provider capacity issue, not a user error.
      const retryAfterSeconds = Math.ceil(parseRetryAfterMs(message) / 1000);
      super.catch(
        new HttpException(
          {
            message: 'AI is under high demand. Your request will be retried automatically.',
            code: 'AI_BUSY',
            retryable: true,
            retryAfterSeconds,
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        ),
        host,
      );
      return;
    }

    super.catch(exception, host);
  }
}
