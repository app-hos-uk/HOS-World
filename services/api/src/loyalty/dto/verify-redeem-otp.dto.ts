import { IsString, IsUUID, Length } from 'class-validator';

export class VerifyRedeemOtpDto {
  @IsUUID()
  membershipId!: string;

  @IsUUID()
  storeId!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
