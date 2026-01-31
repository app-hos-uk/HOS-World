import { IsString, IsNumber, IsOptional, IsObject, Min } from 'class-validator';

export class AddToCartDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsObject()
  variationOptions?: Record<string, string>;
}
