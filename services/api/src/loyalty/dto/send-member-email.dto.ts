import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AdminLoyaltySendMemberEmailDto {
  @IsString()
  @MaxLength(120)
  templateSlug: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  /** Loyalty member user IDs (not membership row IDs). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  @IsUUID('4', { each: true })
  memberIds?: string[];

  @IsOptional()
  @IsBoolean()
  sendToAll?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  onlyUnverified?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dryRun?: boolean;
}
