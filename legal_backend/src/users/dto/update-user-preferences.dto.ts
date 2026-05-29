import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateUserPreferencesDto {
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  taskReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  billingAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  trustApprovalAlerts?: boolean;
}
