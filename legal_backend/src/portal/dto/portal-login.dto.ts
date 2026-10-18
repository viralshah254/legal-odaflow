import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class PortalLoginDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  inviteToken!: string;
}
