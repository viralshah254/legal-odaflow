import { IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CopilotChatDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsString()
  @MinLength(1)
  message!: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['AUTO', 'PREMIUM'])
  modelMode?: 'AUTO' | 'PREMIUM';

  @IsOptional()
  @IsString()
  premiumModelId?: string;
}

export class CreateCopilotSessionDto {
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
