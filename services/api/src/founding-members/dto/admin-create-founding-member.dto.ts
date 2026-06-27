import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateFoundingMemberDto } from './create-founding-member.dto';

export class AdminCreateFoundingMemberDto extends CreateFoundingMemberDto {
  @ApiPropertyOptional({
    default: false,
    description: 'Send welcome confirmation email after adding this member',
  })
  @IsOptional()
  @IsBoolean()
  sendConfirmationEmail?: boolean;
}
