import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class EnrollAmbassadorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  profileImage?: string;

  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;
}
