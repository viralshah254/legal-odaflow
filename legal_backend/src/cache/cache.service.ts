import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export type CacheNamespace =
  | 'ai:preview'
  | 'ai:research'
  | 'ai:explainer'
  | 'ai:playbook'
  | 'legal:search'
  | 'embed:chunk'
  | 'issue-checker:session';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): Redis {
    if (!this.client) {
      this.client = new Redis(
        this.configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
        { maxRetriesPerRequest: 3 },
      );
    }
    return this.client;
  }

  buildKey(namespace: CacheNamespace, parts: string[]): string {
    return `${namespace}:${parts.join(':')}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.getClient().get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const payload = JSON.stringify(value);
      const ttl =
        ttlSeconds ??
        Number(
          this.configService.get<string>('LEGAL_CONNECTOR_CACHE_TTL_SECONDS', '86400'),
        );

      await this.getClient().set(key, payload, 'EX', ttl);
    } catch {
      // Cache failures should not break primary flows.
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.getClient().del(key);
    } catch {
      // ignore
    }
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }
}
