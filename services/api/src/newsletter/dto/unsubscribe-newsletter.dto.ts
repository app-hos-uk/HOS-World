import { IsEmail } from 'class-validator';

export class UnsubscribeNewsletterDto {
  // Required: lowercasing an absent email is what made this endpoint answer 500.
  @IsEmail()
  email: string;
}
