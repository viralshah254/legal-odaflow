import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@/cache/cache.service';

const HOURLY_AI_LIMIT = 12;
const HOURLY_TEASER_LIMIT = 2;
const DAILY_TEASER_LIMIT = 2;

@Injectable()
export class IssueCheckerAbuseService {
  constructor(
    private readonly cache: CacheService,
    private readonly configService: ConfigService,
  ) {}

  async assertWithinLimits(input: {
    route: string;
    ip?: string;
    deviceFingerprint?: string;
    isTeaser?: boolean;
  }): Promise<void> {
    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      return;
    }

    const ipKey = input.ip ? this.hashKey(`ip:${input.ip}:${input.route}`) : null;
    const fingerprintKey = input.deviceFingerprint
      ? this.hashKey(`fp:${input.deviceFingerprint}:${input.route}`)
      : null;

    if (input.isTeaser) {
      await this.assertCounter(
        fingerprintKey ?? ipKey ?? `anon:${input.route}`,
        DAILY_TEASER_LIMIT,
        86_400,
        'Daily issue-checker teaser limit reached',
      );
      if (ipKey) {
        await this.assertCounter(ipKey, HOURLY_TEASER_LIMIT, 3_600, 'Issue-checker teaser rate limit reached');
      }
      return;
    }

    const hourlyLimit = HOURLY_AI_LIMIT;
    if (ipKey) {
      await this.assertCounter(ipKey, hourlyLimit, 3_600, 'Issue-checker rate limit reached for this IP');
    }
    if (fingerprintKey) {
      await this.assertCounter(
        fingerprintKey,
        hourlyLimit,
        3_600,
        'Issue-checker rate limit reached for this device',
      );
    }
  }

  private async assertCounter(
    keySuffix: string,
    limit: number,
    ttlSeconds: number,
    message: string,
  ): Promise<void> {
    const key = `issue-checker:abuse:${keySuffix}`;
    const count = await this.cache.increment(key, ttlSeconds);
    if (count > limit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private hashKey(raw: string): string {
    const salt = this.configService.get<string>('DEVICE_FINGERPRINT_SALT', 'umbrella-referral-salt');
    return createHash('sha256').update(`${salt}:${raw}`).digest('hex').slice(0, 32);
  }
}
