import { IsOptional, IsString, MinLength } from 'class-validator';

export class DeliverReviewDto {
  @IsString()
  @MinLength(10)
  lawyerOpinionMarkdown!: string;

  @IsOptional()
  @IsString()
  recommendations?: string;
}

export class PayReviewRequestDto {
  @IsOptional()
  @IsString()
  phone?: string;
}
