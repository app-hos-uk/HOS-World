import { IsArray, IsString } from 'class-validator';

export class FandomQuizDto {
  @IsArray()
  @IsString({ each: true })
  favoriteFandoms: string[];

  @IsArray()
  @IsString({ each: true })
  interests: string[];
}

