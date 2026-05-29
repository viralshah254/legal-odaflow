import * as Sentry from '@sentry/node';

let initialized = false;

export function initSentry(serviceName: string): void {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn || initialized) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  });

  Sentry.setTag('service', serviceName);
  initialized = true;
}

/** NestJS-friendly request error capture (use with SentryGlobalFilter when @sentry/nestjs is added). */
export function captureException(error: unknown): void {
  if (initialized) {
    Sentry.captureException(error);
  }
}

export { Sentry };
