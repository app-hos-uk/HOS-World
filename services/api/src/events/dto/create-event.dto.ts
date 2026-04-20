import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsIn(['IN_STORE', 'VIRTUAL', 'HYBRID', 'PRODUCT_LAUNCH', 'FAN_MEETUP', 'VIP_EXPERIENCE'])
  type?: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  venueName?: string;

  @IsOptional()
  @IsString()
  venueAddress?: string;

  @IsOptional()
  @IsString()
  virtualUrl?: string;

  @IsOptional()
  @IsString()
  virtualPlatform?: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsDateString()
  doorsOpenAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  minTierLevel?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedTierIds?: string[];

  @IsOptional()
  @IsBoolean()
  requiresTicket?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ticketPrice?: number;

  @IsOptional()
  @IsString()
  ticketCurrency?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  attendancePoints?: number;

  @IsOptional()
  @IsString()
  earnRuleAction?: string;

  @IsOptional()
  @IsString()
  fandomId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  hostName?: string;

  @IsOptional()
  @IsString()
  hostBio?: string;

  @IsOptional()
  agenda?: unknown;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;
}
