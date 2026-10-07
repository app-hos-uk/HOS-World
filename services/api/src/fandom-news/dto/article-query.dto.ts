import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ArticleQueryDto {
  @ApiPropertyOptional({ enum: ['auto', 'approved', 'featured', 'hidden'] })
  @IsOptional()
  @IsIn(['auto', 'approved', 'featured', 'hidden'])
  status?: string;

  @ApiPropertyOptional({ example: 'Marvel' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ example: 'US' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  market?: string;

  @ApiPropertyOptional({ enum: ['article', 'video', 'gallery'] })
  @IsOptional()
  @IsIn(['article', 'video', 'gallery'])
  mediaType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  sourceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}

export class FandomWorldFeedQueryDto {
  @ApiPropertyOptional({ example: 'US' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  market?: string;

  @ApiPropertyOptional({ default: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 6;
}
