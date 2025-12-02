import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateReturnDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}


