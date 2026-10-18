import { IsString } from 'class-validator';

export class ConfirmCheckoutDto {
  @IsString()
  sessionId!: string;
}
