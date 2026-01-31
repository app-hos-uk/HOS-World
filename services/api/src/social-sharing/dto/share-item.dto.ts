import { IsEnum, IsString, IsOptional } from 'class-validator';

export enum ShareItemType {
  PRODUCT = 'PRODUCT',
  COLLECTION = 'COLLECTION',
  WISHLIST = 'WISHLIST',
  ACHIEVEMENT = 'ACHIEVEMENT',
  QUEST = 'QUEST',
}

export class ShareItemDto {
  @IsEnum(ShareItemType)
  type: ShareItemType;

  @IsString()
  itemId: string;

  @IsOptional()
  @IsString()
  platform?: string; // 'facebook', 'twitter', 'copy_link', etc.
}
