import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class RedeemInStoreDto {
  @IsInt()
  @Min(1)
  points!: number;

  @IsUUID()
  storeId!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  idempotencyKey?: string;
}
