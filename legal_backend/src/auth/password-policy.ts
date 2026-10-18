import { applyDecorators } from '@nestjs/common';
import {
  IsString,
  IsStrongPassword,
  MinLength,
  type ValidationOptions,
} from 'class-validator';

export const PASSWORD_POLICY = {
  minLength: 8,
  minLowercase: 0,
  minUppercase: 0,
  minNumbers: 1,
  minSymbols: 0,
} as const;

export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and include at least one number';

export function IsPasswordPolicy(validationOptions?: ValidationOptions) {
  return applyDecorators(
    IsString(validationOptions),
    MinLength(PASSWORD_POLICY.minLength, validationOptions),
    IsStrongPassword(PASSWORD_POLICY, {
      message: PASSWORD_POLICY_MESSAGE,
      ...validationOptions,
    }),
  );
}
