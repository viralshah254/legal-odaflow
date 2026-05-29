import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class WebhookTestDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  event?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
