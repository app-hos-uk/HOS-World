import { IsBoolean, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

export class SellerReviewCancellationDto {
  @IsBoolean()
  approved: boolean;

  @ValidateIf((dto) => dto.approved === false)
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required when rejecting a cancellation request' })
  @MaxLength(2000)
  notes?: string;
}
