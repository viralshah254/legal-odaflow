import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { CacheService } from '@/cache/cache.service';

export interface ClaimVerificationCacheEntry {
  pass: boolean;
  verifierVersion: string;
  checkedAt: string;
}

@Injectable()
export class LegalResearchClaimCacheService {
  constructor(private readonly cache: CacheService) {}

  private key(parts: string[]): string {
    return this.cache.buildKey('ai:research', ['claim-verify', ...parts]);
  }

  async get(
    propositionHash: string,
    passageHash: string,
    verifierVersion: string,
  ): Promise<ClaimVerificationCacheEntry | null> {
    return this.cache.get<ClaimVerificationCacheEntry>(
      this.key([propositionHash, passageHash, verifierVersion]),
    );
  }

  async set(
    propositionHash: string,
    passageHash: string,
    verifierVersion: string,
    entry: ClaimVerificationCacheEntry,
  ): Promise<void> {
    await this.cache.set(this.key([propositionHash, passageHash, verifierVersion]), entry);
  }

  static hashText(text: string): string {
    return createHash('sha256').update(text.trim()).digest('hex').slice(0, 24);
  }
}
