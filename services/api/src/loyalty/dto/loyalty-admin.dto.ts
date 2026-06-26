import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsNumber,
  IsArray,
  IsObject,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateLoyaltyTierDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsInt() @Min(0) level?: number;
  @IsOptional() @IsInt() @Min(0) pointsThreshold?: number;
  @IsOptional() @IsNumber() @Type(() => Number) multiplier?: number;
  @IsOptional() @IsNumber() @Type(() => Number) spendWeight?: number;
  @IsOptional() @IsNumber() @Type(() => Number) frequencyWeight?: number;
  @IsOptional() @IsNumber() @Type(() => Number) engagementWeight?: number;
  @IsOptional() @IsObject() benefits?: Record<string, any>;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsBoolean() inviteOnly?: boolean;
  @IsOptional() @IsInt() @Min(0) maxMembers?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateEarnRuleDto {
  @IsString() name!: string;
  @IsString() action!: string;
  @IsInt() @Min(0) pointsAmount!: number;
  @IsOptional() @IsString() pointsType?: string;
  @IsOptional() @IsBoolean() multiplierStack?: boolean;
  @IsOptional() @IsInt() @Min(0) maxPerDay?: number;
  @IsOptional() @IsInt() @Min(0) maxPerMonth?: number;
  @IsOptional() @IsInt() @Min(0) maxPerUser?: number;
  @IsOptional() @IsObject() conditions?: Record<string, any>;
  @IsOptional() @IsArray() @IsString({ each: true }) regionCodes?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
}

export class UpdateEarnRuleDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsInt() @Min(0) pointsAmount?: number;
  @IsOptional() @IsString() pointsType?: string;
  @IsOptional() @IsBoolean() multiplierStack?: boolean;
  @IsOptional() @IsInt() @Min(0) maxPerDay?: number;
  @IsOptional() @IsInt() @Min(0) maxPerMonth?: number;
  @IsOptional() @IsInt() @Min(0) maxPerUser?: number;
  @IsOptional() @IsObject() conditions?: Record<string, any>;
  @IsOptional() @IsArray() @IsString({ each: true }) regionCodes?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
}

export class CreateRedemptionOptionDto {
  @IsString() name!: string;
  @IsString() type!: string;
  @IsInt() @Min(1) pointsCost!: number;
  @IsOptional() @IsNumber() @Type(() => Number) value?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsInt() @Min(0) stock?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) regionCodes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) channels?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
}

export class UpdateRedemptionOptionDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsInt() @Min(1) pointsCost?: number;
  @IsOptional() @IsNumber() @Type(() => Number) value?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsInt() @Min(0) stock?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) regionCodes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) channels?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
}

export class CreateCampaignDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() type!: string;
  @IsOptional() @IsNumber() @Type(() => Number) multiplier?: number;
  @IsOptional() @IsInt() @Min(0) bonusPoints?: number;
  @IsOptional() @IsObject() conditions?: Record<string, any>;
  @IsOptional() @IsArray() @IsString({ each: true }) regionCodes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) channelCodes?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
}

export class UpdateCampaignDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() @Type(() => Number) multiplier?: number;
  @IsOptional() @IsInt() @Min(0) bonusPoints?: number;
  @IsOptional() @IsObject() conditions?: Record<string, any>;
  @IsOptional() @IsArray() @IsString({ each: true }) regionCodes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) channelCodes?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
}
