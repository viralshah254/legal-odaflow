import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class PortalLoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;
}
