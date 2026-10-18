import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PasswordBreachService {
  private readonly logger = new Logger(PasswordBreachService.name);

  constructor(private readonly configService: ConfigService) {}

  /** Have I Been Pwned k-anonymity range API. */
  async isBreached(password: string): Promise<boolean> {
    const enabled = this.configService.get<string>('PASSWORD_BREACH_CHECK', 'true') !== 'false';
    if (!enabled) return false;

    const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    try {
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true' },
        signal: AbortSignal.timeout(4000),
      });

      if (!response.ok) {
        this.logger.warn(`HIBP lookup failed with status ${response.status}`);
        throw new Error('BREACH_CHECK_UNAVAILABLE');
      }

      const body = await response.text();
      return body.split('\n').some((line) => {
        const [hashSuffix] = line.trim().split(':');
        return hashSuffix === suffix;
      });
    } catch (error) {
      this.logger.warn(`HIBP lookup error: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }
}
