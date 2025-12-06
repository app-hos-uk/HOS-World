import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Public()
  @Get('requirements/:country')
  async getRequirements(@Param('country') country: string): Promise<ApiResponse<any>> {
    const requirements = this.complianceService.getRequirements(country.toUpperCase());
    return {
      data: requirements,
      message: 'Compliance requirements retrieved successfully',
    };
  }

  @Public()
  @Get('tax-rates/:country')
  async getTaxRates(@Param('country') country: string): Promise<ApiResponse<{ rate: number }>> {
    const rate = this.complianceService.getTaxRate(country.toUpperCase());
    return {
      data: { rate },
      message: 'Tax rate retrieved successfully',
    };
  }

  @Public()
  @Post('verify-age')
  async verifyAge(@Body() body: { country: string; age: number }): Promise<ApiResponse<any>> {
    const requiresVerification = this.complianceService.requiresAgeVerification(
      body.country.toUpperCase(),
    );
    const minimumAge = 18; // Default minimum age

    return {
      data: {
        requiresVerification,
        minimumAge,
        isValid: body.age >= minimumAge,
      },
      message: 'Age verification completed',
    };
  }
}

