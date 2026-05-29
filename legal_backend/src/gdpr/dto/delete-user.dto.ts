import { IsEmail } from 'class-validator';

export class DeleteUserDataDto {
  @IsEmail()
  confirmEmail!: string;
}
