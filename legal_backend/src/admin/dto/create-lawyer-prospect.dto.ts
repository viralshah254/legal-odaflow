import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const PRACTICE_TYPES = ['SOLO', 'FIRM'] as const;

export class CreateLawyerProspectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsIn([...PRACTICE_TYPES])
  practiceType!: (typeof PRACTICE_TYPES)[number];

  @ValidateIf((dto: CreateLawyerProspectDto) => dto.practiceType === 'FIRM')
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  organisation?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(30)
  phone!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;
}
