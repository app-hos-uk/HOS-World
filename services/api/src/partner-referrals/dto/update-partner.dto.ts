import { PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { CreatePartnerDto, PARTNER_STATUSES } from './create-partner.dto';

export class UpdatePartnerDto extends PartialType(CreatePartnerDto) {
  @IsOptional()
  @IsString()
  @IsIn(PARTNER_STATUSES)
  status?: string;
}
