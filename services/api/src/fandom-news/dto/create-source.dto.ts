import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateSourceDto {
  @ApiProperty({ example: 'Marvel Entertainment' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'https://example.com/feed.xml' })
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  feedUrl: string;

  @ApiPropertyOptional({ example: 'rss', default: 'rss' })
  @IsOptional()
  @IsIn(['rss', 'atom'])
  feedType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  logoUrl?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: ['US'], description: 'Empty means every market' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  marketCodes?: string[];

  @ApiPropertyOptional({ example: ['Marvel'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];
}
