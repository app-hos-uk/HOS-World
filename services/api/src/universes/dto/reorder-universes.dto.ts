import { IsArray, IsString } from 'class-validator';

export class ReorderUniversesDto {
  @IsArray()
  @IsString({ each: true })
  orderedIds: string[];
}
