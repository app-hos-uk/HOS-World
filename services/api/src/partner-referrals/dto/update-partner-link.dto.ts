import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreatePartnerLinkDto } from './create-partner-link.dto';

export class UpdatePartnerLinkDto extends PartialType(CreatePartnerLinkDto) {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
