import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { PRACTICE_AREA_SLUGS } from '@/config/practice-areas';

const SUPPORTED_UI_LOCALES = [
  'en', 'fr', 'de', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'kn', 'ml', 'ur', 'pa', 'or', 'as',
] as const;

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

  @IsOptional()
  @IsIn(PRACTICE_AREA_SLUGS)
  primaryPracticeArea?: string;

  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_UI_LOCALES])
  preferredLocale?: string;

  /** Per-tour progress: { "app.dashboard": { completedAt, dismissedPanel } } */
  @IsOptional()
  @IsObject()
  tutorialProgress?: Record<string, unknown>;
}
