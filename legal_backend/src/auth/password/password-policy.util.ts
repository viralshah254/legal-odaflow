import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_ERROR_CODES,
  type PasswordPolicyErrorCode,
} from './password-policy.constants';

export interface PasswordPolicyContext {
  email?: string;
  name?: string;
  firmName?: string;
  phone?: string;
}

export interface PasswordPolicyResult {
  valid: boolean;
  score: number;
  errors: PasswordPolicyErrorCode[];
  feedback: string[];
}

function passwordHasNumber(password: string): boolean {
  return /\d/.test(password);
}

export function validatePasswordPolicy(
  password: string,
  _context?: PasswordPolicyContext,
): PasswordPolicyResult {
  const errors: PasswordPolicyErrorCode[] = [];
  const feedback: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(PASSWORD_POLICY_ERROR_CODES.TOO_SHORT);
    feedback.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(PASSWORD_POLICY_ERROR_CODES.TOO_LONG);
    feedback.push(`Use at most ${PASSWORD_MAX_LENGTH} characters.`);
  }

  if (!passwordHasNumber(password)) {
    errors.push(PASSWORD_POLICY_ERROR_CODES.MISSING_NUMBER);
    feedback.push('Include at least one number.');
  }

  return {
    valid: errors.length === 0,
    score: password.length >= PASSWORD_MIN_LENGTH && passwordHasNumber(password) ? 2 : 0,
    errors,
    feedback,
  };
}

export function passwordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
      return 'Very Weak';
    case 1:
      return 'Weak';
    case 2:
      return 'Fair';
    case 3:
      return 'Strong';
    default:
      return 'Very Strong';
  }
}
