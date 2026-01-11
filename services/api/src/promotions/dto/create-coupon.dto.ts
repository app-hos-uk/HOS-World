import { IsString, IsOptional, IsInt, IsDateString } from 'class-validator';

export class CreateCouponDto {
  @IsString()
  code: string;

  @IsString()
  promotionId: string;

  @IsOptional()
  @IsInt()
  usageLimit?: number;

  @IsOptional()
  @IsInt()
  userLimit?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
