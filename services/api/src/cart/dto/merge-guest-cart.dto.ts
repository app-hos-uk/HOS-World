import { IsString, MinLength, MaxLength } from 'class-validator';

export class MergeGuestCartDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  guestSessionId: string;
}
