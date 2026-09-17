import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeactivateFoundingMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
