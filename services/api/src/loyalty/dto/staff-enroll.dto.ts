import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class StaffEnrollDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  phone?: string;

  /** ISO / alias country for phone normalisation (e.g. GB, US, UAE). Required for national-format mobiles. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  country?: string;
}
