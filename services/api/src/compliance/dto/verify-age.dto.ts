import { IsInt, IsString, Max, Min } from 'class-validator';

export class VerifyAgeDto {
  // Required: uppercasing an absent country is what made this endpoint answer 500.
  @IsString()
  country: string;

  @IsInt()
  @Min(0)
  @Max(150)
  age: number;
}
