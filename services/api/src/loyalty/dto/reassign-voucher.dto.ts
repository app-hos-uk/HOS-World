import { IsUUID } from 'class-validator';

export class ReassignVoucherDto {
  @IsUUID()
  storeId!: string;
}
