import { IsUUID } from 'class-validator';

export class SendRedeemOtpDto {
  @IsUUID()
  membershipId!: string;

  @IsUUID()
  storeId!: string;
}
