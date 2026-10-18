import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export type CacheNamespace =
  | 'ai:preview'
  | 'ai:research'
  | 'ai:explainer'
  | 'ai:playbook'
  | 'legal:search'
  | 'legal:retrieval'
  | 'authority-thread'
  | 'embed:chunk'
  | 'issue-checker:session'
  | 'legal-research:session'
  | 'issue-checker:abuse';

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

  async increment(key: string, ttlSeconds: number): Promise<number> {
    try {
      const client = this.getClient();
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, ttlSeconds);
      }
      return count;
    } catch {
      return Number.MAX_SAFE_INTEGER;
    }
  }

  async delByPattern(pattern: string): Promise<number> {
    try {
      const client = this.getClient();
      let cursor = '0';
      let deleted = 0;
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          deleted += await client.del(...keys);
        }
      } while (cursor !== '0');
      return deleted;
    } catch {
      return 0;
    }
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }
}
