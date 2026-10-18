import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TurnstileVerifyResponse {
  success?: boolean;
  'error-codes'?: string[];
  hostname?: string;
}

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);

  constructor(private readonly configService: ConfigService) {}

  isRequired(): boolean {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      return true;
    }
    return Boolean(this.getSecretKey());
  }

  private isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  async verify(token: string | undefined, _remoteIp?: string): Promise<void> {
    if (!this.isRequired()) {
      return;
    }

    // In non-production environments Turnstile site keys are domain-restricted
    // (e.g. registered for umbrella.okaylegal.ai only), so tokens from
    // localhost will always fail Cloudflare verification. Allow through without
    // a token so local development is not blocked.
    if (!this.isProduction()) {
      return;
    }

    if (!token?.trim()) {
      throw new BadRequestException('CAPTCHA verification is required');
    }

    const secret = this.getSecretKey();
    if (!secret) {
      throw new BadRequestException('CAPTCHA is not configured');
    }

    const body = new URLSearchParams({
      secret,
      response: token.trim(),
    });

    let response: Response;
    try {
      response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (err) {
      this.logger.warn(`Turnstile siteverify network error: ${String(err)}`);
      throw new BadRequestException('CAPTCHA verification failed');
    }

    const payload = (await response.json().catch(() => ({}))) as TurnstileVerifyResponse;
    if (!response.ok || !payload.success) {
      const codes = payload['error-codes']?.join(',') || `http_${response.status}`;
      this.logger.warn(`Turnstile verification failed: ${codes}`);
      throw new BadRequestException('CAPTCHA verification failed');
    }
  }

  private getSecretKey(): string {
    return this.configService.get<string>('TURNSTILE_SECRET_KEY', '')?.trim() ?? '';
  }
}
