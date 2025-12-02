import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class AssignCustomDomainDto {
  @IsString()
  @IsNotEmpty()
  customDomain: string;

  @IsOptional()
  @IsBoolean()
  domainPackagePurchased?: boolean;
}

export class CreateSubDomainDto {
  @IsString()
  @IsNotEmpty()
  subDomain: string;
}

