import { Controller, Get, Post, Body, UseGuards, Request, Ip } from '@nestjs/common';
import { GeolocationService } from './geolocation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('geolocation')
export class GeolocationController {
  constructor(private readonly geolocationService: GeolocationService) {}

  @Public()
  @Get('detect')
  async detectCountry(@Ip() ip: string): Promise<ApiResponse<any>> {
    const countryInfo = await this.geolocationService.detectCountryFromIP(ip);
    return {
      data: countryInfo,
      message: 'Country detected successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('confirm')
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

