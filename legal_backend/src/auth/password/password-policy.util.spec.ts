import { validatePasswordPolicy } from './password-policy.util';
import { PASSWORD_POLICY_ERROR_CODES } from './password-policy.constants';

describe('validatePasswordPolicy', () => {
  it('rejects passwords shorter than 8 characters', () => {
    const result = validatePasswordPolicy('pass1');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(PASSWORD_POLICY_ERROR_CODES.TOO_SHORT);
  });

  it('rejects passwords without a number', () => {
    const result = validatePasswordPolicy('password');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(PASSWORD_POLICY_ERROR_CODES.MISSING_NUMBER);
  });

  it('accepts a password with 8 characters and a number', () => {
    const result = validatePasswordPolicy('secure12');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
