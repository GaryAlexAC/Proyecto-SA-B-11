import { IsDateString, IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCashierDto {
  @IsString() @IsNotEmpty() @Matches(/\S/) @MaxLength(150) fullName!: string;
  @IsString() @IsNotEmpty() @Matches(/\S/) @MaxLength(50) document!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsDateString() birthDate!: string;
  @IsString() @IsNotEmpty() @Matches(/\S/) @MaxLength(300) address!: string;
  @IsString() @MinLength(8) @MaxLength(128) @Matches(/[a-z]/) @Matches(/[A-Z]/) @Matches(/[0-9]/) password!: string;
}
