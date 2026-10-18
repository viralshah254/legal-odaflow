import { IsEmail } from 'class-validator';

export class EmailLookupDto {
  @IsEmail()
  email!: string;
}

export interface EmailLookupResult {
  exists: boolean;
  hasPassword: boolean;
  /** True when the user has a linked Firebase account (email/password or OAuth). */
  hasFirebaseAccount: boolean;
}
