import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreatePortalInviteDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  clientId!: string;
}
