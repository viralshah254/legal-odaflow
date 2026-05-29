import { IsString, MinLength } from 'class-validator';

export class DeleteTenantDataDto {
  @IsString()
  @MinLength(2)
  confirmTenantName!: string;
}
