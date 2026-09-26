import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class AudienceFiltersDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tierSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  regionCode?: string;
}

export class ResolveAudienceDto {
  @IsIn(['INDIVIDUAL', 'SEGMENT', 'ALL'])
  audienceType: 'INDIVIDUAL' | 'SEGMENT' | 'ALL';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  @IsUUID('4', { each: true })
  userIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AudienceFiltersDto)
  filters?: AudienceFiltersDto;
}
