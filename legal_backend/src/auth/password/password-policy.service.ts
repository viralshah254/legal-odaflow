import { BadRequestException, Injectable } from '@nestjs/common';
import { PASSWORD_POLICY_ERROR_CODES } from './password-policy.constants';
import {
  type PasswordPolicyContext,
  type PasswordPolicyResult,
  validatePasswordPolicy,
} from './password-policy.util';

const ERROR_MESSAGES: Record<string, string> = {
  [PASSWORD_POLICY_ERROR_CODES.TOO_SHORT]:
    'Password must be at least 8 characters long.',
  [PASSWORD_POLICY_ERROR_CODES.TOO_LONG]:
    'Password must be at most 128 characters long.',
  [PASSWORD_POLICY_ERROR_CODES.MISSING_NUMBER]:
    'Password must include at least one number.',
};

@Injectable()
export class PasswordPolicyService {
  analyze(password: string, context?: PasswordPolicyContext): PasswordPolicyResult {
    return validatePasswordPolicy(password, context);
  }

  assertValid(password: string, context?: PasswordPolicyContext): void {
    const result = this.analyze(password, context);
    if (!result.valid) {
      throw new BadRequestException(this.formatMessage(result));
    }
  }

  async assertValidIncludingBreachCheck(
    password: string,
    context?: PasswordPolicyContext,
  ): Promise<void> {
    this.assertValid(password, context);
  }

  private formatMessage(result: PasswordPolicyResult): string {
    const primary = result.errors[0];
    if (primary && ERROR_MESSAGES[primary]) {
      return ERROR_MESSAGES[primary];
    }
    return result.feedback[0] ?? 'Password does not meet security requirements.';
  }
}
