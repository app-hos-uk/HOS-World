import { Controller, Get, Post, Body, UseGuards, Request, Ip Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { GeolocationService } from './geolocation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('geolocation')
@Version('1')
@Controller('geolocation')
export class GeolocationController {
  constructor(private readonly geolocationService: GeolocationService) {}

  @Public()
  @Get('detect')
  @ApiOperation({ summary: 'Detect country from IP', description: 'Detects the country and currency based on the client IP address. Public endpoint.' })
  @SwaggerApiResponse({ status: 200, description: 'Country detected successfully' })
  async detectCountry(@Ip() ip: string): Promise<ApiResponse<any>> {
    const countryInfo = await this.geolocationService.detectCountryFromIP(ip);
    return {
      data: countryInfo,
      message: 'Country detected successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('confirm')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Confirm country selection', description: 'Confirms and saves the user\'s country and currency preference. Requires authentication.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['country'],
      properties: {
        country: { type: 'string', description: 'Country name' },
        countryCode: { type: 'string', description: 'ISO country code (optional)' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Country confirmed successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid country data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async confirmCountry(
    @Request() req: any,
    @Body() body: { country: string; countryCode?: string },
  ): Promise<ApiResponse<any>> {
    const currency = body.countryCode
      ? this.geolocationService.getCurrencyForCountry(body.countryCode)
      : 'GBP';

    // Update user's country and currency
    await this.geolocationService['prisma'].user.update({
      where: { id: req.user.id },
      data: {
        country: body.country,
        currencyPreference: currency,
        countryDetectedAt: new Date(),
      },
    });

    return {
      data: { country: body.country, currency },
      message: 'Country confirmed successfully',
    };
  }
}

