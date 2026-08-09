import { Type } from 'class-transformer';
import { IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator';
import { RegisterDto } from './register.dto';

export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  // Nested, and validated as such: an absent registerDto reached the service as undefined and
  // surfaced as a 500 rather than a 400.
  @IsObject()
  @ValidateNested()
  @Type(() => RegisterDto)
  registerDto: RegisterDto;
}
