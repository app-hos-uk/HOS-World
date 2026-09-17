import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeactivateMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
