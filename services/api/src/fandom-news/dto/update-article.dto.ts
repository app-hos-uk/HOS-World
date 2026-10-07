import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateArticleDto {
  @ApiPropertyOptional({ enum: ['auto', 'approved', 'featured', 'hidden'] })
  @IsOptional()
  @IsIn(['auto', 'approved', 'featured', 'hidden'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  marketCodes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  videoUrl?: string;

  @ApiPropertyOptional({ example: 'youtube' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  videoType?: string;

  @ApiPropertyOptional({ enum: ['article', 'video', 'gallery'] })
  @IsOptional()
  @IsIn(['article', 'video', 'gallery'])
  mediaType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  excerpt?: string;
}

export class BulkUpdateArticlesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids: string[];

  @ApiProperty({ enum: ['auto', 'approved', 'featured', 'hidden'] })
  @IsIn(['auto', 'approved', 'featured', 'hidden'])
  status: string;
}
