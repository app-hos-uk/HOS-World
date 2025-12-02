import { IsBoolean } from 'class-validator';

export class ReviewHelpfulDto {
  @IsBoolean()
  helpful: boolean;
}


