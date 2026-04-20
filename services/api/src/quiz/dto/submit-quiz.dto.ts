import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class SubmitQuizDto {
  @IsArray()
  @ArrayMinSize(0)
  @IsInt({ each: true })
  answers!: number[];
}
