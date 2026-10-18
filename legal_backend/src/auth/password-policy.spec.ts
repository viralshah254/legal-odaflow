import { validate } from 'class-validator';
import { IsPasswordPolicy } from './password-policy';

class PasswordHolder {
  @IsPasswordPolicy()
  password!: string;

  constructor(password: string) {
    this.password = password;
  }
}

describe('IsPasswordPolicy', () => {
  it('rejects passwords without a number', async () => {
    const errors = await validate(new PasswordHolder('password'));

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe('password');
  });

  it('rejects passwords shorter than 8 characters', async () => {
    const errors = await validate(new PasswordHolder('pass1'));

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe('password');
  });

  it('accepts a password meeting requirements', async () => {
    const errors = await validate(new PasswordHolder('secure12'));

    expect(errors).toHaveLength(0);
  });
});
