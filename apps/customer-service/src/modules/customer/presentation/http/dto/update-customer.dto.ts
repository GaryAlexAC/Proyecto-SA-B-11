import { IsDateString, IsEmail, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class UpdateCustomerDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @Matches(/\S/) @MaxLength(150) fullName?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() @Matches(/\S/) @MaxLength(300) address?: string;
}
