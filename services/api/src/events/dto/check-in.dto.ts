import { IsIn, IsOptional, IsString } from 'class-validator';

export class CheckInDto {
  @IsOptional()
  @IsString()
  ticketCode?: string;

  @IsOptional()
  @IsIn(['QR_SCAN', 'MANUAL', 'VIRTUAL_JOIN', 'TICKET_SCAN'])
  method?: string;
}
