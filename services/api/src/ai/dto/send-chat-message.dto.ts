import { IsString, IsNotEmpty } from 'class-validator';

export class SendChatMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}

