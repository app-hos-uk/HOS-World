import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendTestEmailDto {
  @ApiProperty({ example: 'arun@houseofspells.com' })
  @IsEmail()
  @IsNotEmpty()
  to: string;
}
