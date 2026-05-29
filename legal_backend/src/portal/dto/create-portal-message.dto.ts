import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePortalMessageDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  matterId?: string;

  @IsString()
  @MinLength(1)
  subject!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsBoolean()
  fromFirm?: boolean;
}
