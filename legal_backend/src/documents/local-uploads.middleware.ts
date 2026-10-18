import { UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { LocalUploadTokenService } from './local-upload-token.service';

/**
 * Local dev storage: PUT/GET bytes at /uploads/* (outside /api/v1).
 * Requires signed JWT tokens bound to key + HTTP method.
 */
export function registerLocalUploadsMiddleware(app: INestApplication) {
  const config = app.get(ConfigService);
  if (config.get<string>('S3_PROVIDER', 'local') !== 'local') {
    return;
  }

  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const allowLocalUploads =
    config.get<string>('ALLOW_LOCAL_UPLOADS_IN_PRODUCTION') === 'true';
  if (isProduction && !allowLocalUploads) {
    throw new Error(
      'Refusing to register unauthenticated local upload middleware in production. Configure S3_PROVIDER or set ALLOW_LOCAL_UPLOADS_IN_PRODUCTION=true only for isolated test environments.',
    );
  }

  const tokenService = app.get(LocalUploadTokenService);
  const uploadRoot = config.get<string>('UPLOAD_DIR', join(process.cwd(), 'uploads'));
  mkdirSync(uploadRoot, { recursive: true });

  const router = express.Router();

  router.put(
    '/*',
    express.raw({ type: '*/*', limit: '50mb' }),
    (req, res) => {
      const key = req.path.replace(/^\//, '');
      if (!key || key.includes('..')) {
        res.status(400).send('Invalid upload path');
        return;
      }

      const token = typeof req.query.token === 'string' ? req.query.token : null;
      if (!token) {
        res.status(401).send('Upload token required');
        return;
      }

      try {
        tokenService.verifyToken(token, key, 'PUT');
      } catch {
        res.status(401).send('Invalid upload token');
        return;
      }

      const target = join(uploadRoot, key);
      mkdirSync(dirname(target), { recursive: true });
      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).send('Empty body');
        return;
      }
      writeFileSync(target, body);
      res.status(200).send('OK');
    },
  );

  router.get('/*', (req, res) => {
    const key = req.path.replace(/^\//, '');
    if (!key || key.includes('..')) {
      res.status(400).send('Invalid path');
      return;
    }

    const token = typeof req.query.token === 'string' ? req.query.token : null;
    if (!token) {
      res.status(401).send('Upload token required');
      return;
    }

    try {
      tokenService.verifyToken(token, key, 'GET');
    } catch {
      res.status(401).send('Invalid upload token');
      return;
    }

    const target = join(uploadRoot, key);
    if (!existsSync(target)) {
      res.status(404).send('Not found');
      return;
    }
    const buffer = readFileSync(target);
    const ext = key.split('.').pop()?.toLowerCase();
    const mime =
      ext === 'pdf'
        ? 'application/pdf'
        : ext === 'png'
          ? 'image/png'
          : ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.send(buffer);
  });

  app.use('/uploads', router);
}
