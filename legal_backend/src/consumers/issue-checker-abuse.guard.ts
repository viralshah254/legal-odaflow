import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { CaptchaService } from '@/security/captcha.service';
import { IssueCheckerAbuseService } from './issue-checker-abuse.service';

@Injectable()
export class IssueCheckerAbuseGuard implements CanActivate {
  constructor(
    private readonly captcha: CaptchaService,
    private readonly abuse: IssueCheckerAbuseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      body?: { captchaToken?: string; deviceFingerprint?: string };
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
      route?: { path?: string };
      url?: string;
    }>();

    const body = request.body ?? {};
    const forwarded = request.headers?.['x-forwarded-for'];
    const ip =
      request.ip ??
      (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();

    const routePath = request.route?.path ?? request.url ?? context.getHandler().name;
    const isTeaser = /teaser/i.test(routePath);

    // CAPTCHA is required only for the expensive teaser path.
    // Classify / plan-questions / outcome-options stay rate-limited so the
    // landing flow can spend its single Turnstile token on teaser only.
    if (isTeaser) {
      await this.captcha.verify(body.captchaToken, ip);
    } else if (body.captchaToken?.trim()) {
      // If a token was sent anyway, verify it (and fail closed on bad tokens)
      // but do not require one.
      await this.captcha.verify(body.captchaToken, ip);
    }

    await this.abuse.assertWithinLimits({
      route: routePath,
      ip,
      deviceFingerprint: body.deviceFingerprint,
      isTeaser,
    });

    return true;
  }
}
