import { IsOptional, IsString, MinLength } from 'class-validator';

export class LookupMemberDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  cardNumber?: string;
}
