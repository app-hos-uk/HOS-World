import { IsString, IsOptional, IsArray } from 'class-validator';

export class CharacterSelectionDto {
  @IsString()
  characterId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  favoriteFandoms?: string[];
}
