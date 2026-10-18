import './register-paths';
import { initSentry } from './common/observability/sentry';

initSentry('legal-backend-api');

import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';
import { registerLocalUploadsMiddleware } from './documents/local-uploads.middleware';
import { parseCorsOrigins } from './common/utils/cors-origins.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  registerLocalUploadsMiddleware(app);

  if (
    configService.get<string>('NODE_ENV') === 'production' &&
    configService.get<string>('S3_PROVIDER', 'local') === 'local'
  ) {
    console.warn(
      'WARNING: S3_PROVIDER=local in production. Local upload middleware is blocked unless ALLOW_LOCAL_UPLOADS_IN_PRODUCTION=true.',
    );
  }

  const corsOrigins = parseCorsOrigins(
    configService.get<string>('CORS_ORIGINS', 'http://localhost:3000'),
  );

  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      // Allow cross-origin reads so intentional browser→API direct calls
      // (issue-checker preview, India draft) are not blocked by CORP.
      // CORS allowlisting remains the access-control mechanism.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
        : false,
    }),
  );

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept-Language',
      'X-Tenant-Id',
      'X-Request-Id',
      'Range',
      'If-Range',
      'If-None-Match',
      'Idempotency-Key',
      'X-Client-Version',
      'X-Platform',
    ],
    exposedHeaders: ['X-Request-Id'],
  });

  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: '', method: RequestMethod.GET }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new RequestContextInterceptor());
  // Order matters: most specific first, catch-all last.
  app.useGlobalFilters(
    new AllExceptionsFilter(),
    new DomainExceptionFilter(),
    new PrismaExceptionFilter(),
  );

  const port = configService.get<number>('PORT', 4000);
  await app.listen(port);

  const appName = configService.get<string>('APP_NAME', 'Umbrella');
  console.log(`${appName} API listening on port ${port}`);
}

bootstrap();
