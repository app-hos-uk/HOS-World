import { IsEmail, IsString, IsOptional, IsArray, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFoundingMemberDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'US' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  country?: string;

  @ApiProperty({ example: ['Harry Potter', 'Marvel', 'Star Wars'] })
  @IsArray()
  @IsString({ each: true })
  fandoms: string[];

  @ApiPropertyOptional({ example: 'Anime, K-Drama' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  otherFranchises?: string;

  @ApiPropertyOptional({ example: 'social_media' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @ApiPropertyOptional({ example: '$100-$500' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  spendBracket?: string;
}
