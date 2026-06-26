import { IsArray, ArrayMaxSize, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ContentBlockDto {
  type: string;
  order?: number;
  data?: Record<string, unknown>;
}

export class UpdateContentBlocksDto {
  @ApiProperty({ description: 'Storefront content blocks (max 50)' })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => Object)
  contentBlocks: ContentBlockDto[];
}
