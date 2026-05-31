import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Email verification token from the verification link' })
  @IsString()
  @IsNotEmpty()
  @MinLength(32)
  token: string;
}
