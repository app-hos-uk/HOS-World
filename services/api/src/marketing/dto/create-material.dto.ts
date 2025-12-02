import { IsString, IsNotEmpty, IsEnum, IsUrl, IsOptional } from 'class-validator';
import { MaterialType } from '@prisma/client';

export class CreateMaterialDto {
  @IsString()
  @IsNotEmpty()
  submissionId: string;

  @IsEnum(MaterialType)
  @IsNotEmpty()
  type: MaterialType;

  @IsUrl()
  @IsNotEmpty()
  url: string;
}

export class UpdateMaterialDto {
  @IsOptional()
  @IsEnum(MaterialType)
  type?: MaterialType;

  @IsOptional()
  @IsUrl()
  url?: string;
}

