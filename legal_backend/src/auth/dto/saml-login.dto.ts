import { IsOptional, IsString } from 'class-validator';

export class SamlLoginDto {
  @IsString()
  tenantId!: string;

  @IsOptional()
  @IsString()
  samlResponse?: string;

  @IsOptional()
  @IsString()
  relayState?: string;
}
