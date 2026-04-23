import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrencyService } from './currency.service';

@ApiTags('admin-global')
@ApiBearerAuth('JWT-auth')
@Controller('admin/global')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class GlobalAdminController {
  constructor(private currency: CurrencyService) {}

  @Get('currencies')
  @ApiOperation({ summary: 'Supported currencies and exchange rates (USD base)' })
  async currencies(): Promise<ApiResponse<unknown>> {
    const supported = this.currency.getSupportedCurrencies();
    const rates = await this.currency.getAllRates();
    return { data: { supported, rates }, message: 'OK' };
  }

  @Post('currencies/refresh')
  @ApiOperation({ summary: 'Refresh cached exchange rates' })
  async refresh(): Promise<ApiResponse<unknown>> {
    await this.currency.updateRates();
    const rates = await this.currency.getAllRates();
    return { data: { rates }, message: 'OK' };
  }
}
