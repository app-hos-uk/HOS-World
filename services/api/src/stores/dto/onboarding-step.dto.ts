import { IsString, MinLength } from 'class-validator';

export class OnboardingStepDto {
  @IsString()
  @MinLength(1)
  step!: string;
}
