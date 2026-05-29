import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class HealthService {
  private redisClient: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getAppHealth() {
    return {
      status: 'ok',
      service: this.configService.get<string>('APP_NAME', 'Legal by OdaFlow'),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  async getDatabaseHealth() {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        status: 'error',
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Database check failed',
      };
    }
  }

  async getRedisHealth() {
    const startedAt = Date.now();
    const redisUrl = this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );

    try {
      if (!this.redisClient) {
        this.redisClient = new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
        });
      }

      if (this.redisClient.status !== 'ready') {
        await this.redisClient.connect();
      }

      const pong = await this.redisClient.ping();

      return {
        status: pong === 'PONG' ? 'ok' : 'degraded',
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        status: 'error',
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Redis check failed',
      };
    }
  }

  getAiHealth() {
    const openAiKey = this.configService.get<string>('OPENAI_API_KEY', '').trim();
    const provider = this.configService.get<string>('AI_PROVIDER', 'openai');
    const configured = Boolean(openAiKey);

    return {
      status: configured ? 'ok' : 'degraded',
      provider,
      configured,
      message: configured
        ? 'AI provider configured'
        : 'OPENAI_API_KEY not set — mock responses enabled',
      timestamp: new Date().toISOString(),
    };
  }
}
