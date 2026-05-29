import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Min, MinLength } from 'class-validator';

export class CreateAutomationRuleDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  trigger!: string;

  @IsOptional()
  conditions?: Record<string, unknown>;

  @IsOptional()
  actions?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  /** v2: require human approval before actions run */
  @IsOptional()
  @IsBoolean()
  approvalRequired?: boolean;

  /** v2: SLA timer in minutes */
  @IsOptional()
  @IsInt()
  @Min(1)
  slaMinutes?: number;

  /** v2: outbound webhook on completion */
  @IsOptional()
  @IsUrl({ require_tld: false })
  webhookUrl?: string;

  /** v2: AI action node type (research, outcome_refresh, draft) */
  @IsOptional()
  @IsString()
  aiActionType?: string;
}

export class UpdateAutomationRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  trigger?: string;

  @IsOptional()
  conditions?: Record<string, unknown>;

  @IsOptional()
  actions?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  approvalRequired?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  slaMinutes?: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  aiActionType?: string;
}

export class CreateAutomationRunDto {
  @IsString()
  ruleId!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  result?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  error?: string;
}
