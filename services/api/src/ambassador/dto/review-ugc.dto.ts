import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewUgcDto {
  @IsString()
  @IsIn(['APPROVED', 'REJECTED', 'FEATURED'])
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNotes?: string;
}
