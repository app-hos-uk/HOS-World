import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const UGC_TYPES = ['PHOTO', 'VIDEO', 'REVIEW', 'STORY', 'UNBOXING', 'SOCIAL_POST'] as const;

const PLATFORMS = ['INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'TWITTER', 'OTHER'] as const;

export class SubmitUgcDto {
  @IsString()
  @IsIn([...UGC_TYPES])
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  socialUrl?: string;

  @IsOptional()
  @IsString()
  @IsIn([...PLATFORMS])
  platform?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  fandomId?: string;
}
