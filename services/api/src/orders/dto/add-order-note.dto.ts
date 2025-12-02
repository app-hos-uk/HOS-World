import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class AddOrderNoteDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsBoolean()
  internal?: boolean;
}


