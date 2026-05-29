import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateClientPortalMessageDto {
  @IsOptional()
  @IsString()
  matterId?: string;

  @IsString()
  @MinLength(1)
  subject!: string;

  @IsString()
  @MinLength(1)
  body!: string;
}
