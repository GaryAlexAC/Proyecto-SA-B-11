import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { KycStatus } from '../generated/prisma/index.js';

const normalizeText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterCustomerDto {
  @Transform(normalizeText)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName: string;

  @Transform(normalizeText)
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  document: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsDateString({ strict: true })
  birthDate: string;

  @Transform(normalizeText)
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  address: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'password debe incluir mayúscula, minúscula y número',
  })
  password: string;
}

export class CreateCashierDto extends RegisterCustomerDto {}

export class UpdateCustomerDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;

  @IsOptional()
  @Transform(normalizeText)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  birthDate?: string;

  @IsOptional()
  @Transform(normalizeText)
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  address?: string;
}

export class VersionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}

export class UpdateKycStatusDto extends VersionDto {
  @IsEnum(KycStatus)
  kycStatus: KycStatus;
}
