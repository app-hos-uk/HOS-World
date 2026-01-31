import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ComplianceService } from './compliance.service';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('compliance')
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Public()
  @Get('requirements/:country')
  @ApiOperation({
    summary: 'Get compliance requirements',
    description: 'Retrieves compliance requirements for a specific country. Public endpoint.',
  })
  @ApiParam({ name: 'country', description: 'ISO country code', type: String })
  @SwaggerApiResponse({
    status: 200,
    description: 'Compliance requirements retrieved successfully',
  })
  async getRequirements(@Param('country') country: string): Promise<ApiResponse<any>> {
    const requirements = this.complianceService.getRequirements(country.toUpperCase());
    return {
      data: requirements,
      message: 'Compliance requirements retrieved successfully',
    };
  }

  @Public()
  @Get('tax-rates/:country')
  @ApiOperation({
    summary: 'Get tax rate',
    description: 'Retrieves the tax rate for a specific country. Public endpoint.',
  })
  @ApiParam({ name: 'country', description: 'ISO country code', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Tax rate retrieved successfully' })
  async getTaxRates(@Param('country') country: string): Promise<ApiResponse<{ rate: number }>> {
    const rate = this.complianceService.getTaxRate(country.toUpperCase());
    return {
      data: { rate },
      message: 'Tax rate retrieved successfully',
    };
  }

  @Public()
  @Post('verify-age')
  @ApiOperation({
    summary: 'Verify age',
    description:
      'Verifies if a user meets the minimum age requirement for a specific country. Public endpoint.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['country', 'age'],
      properties: {
        country: { type: 'string', description: 'ISO country code' },
        age: { type: 'number', description: 'User age' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Age verification completed' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid age data' })
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
