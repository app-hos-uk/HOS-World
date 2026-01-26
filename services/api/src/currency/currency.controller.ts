import { Controller, Get, Query, UseGuards, Request, Version } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CurrencyService } from './currency.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('currency')
@Version('1')
@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Public()
  @Get('rates')
  @ApiOperation({
    summary: 'Get exchange rates',
    description: 'Retrieves all currency exchange rates. Public endpoint, no authentication required.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Exchange rates retrieved successfully' })
  async getRates(): Promise<ApiResponse<Record<string, number>>> {
    const rates = await this.currencyService.getAllRates();
    return {
      data: rates,
      message: 'Exchange rates retrieved successfully',
    };
  }

  @Public()
  @Get('convert')
  @ApiOperation({
    summary: 'Convert currency',
    description: 'Converts an amount from one currency to another. Public endpoint, no authentication required.',
  })
  @ApiQuery({ name: 'amount', required: true, type: String, description: 'Amount to convert' })
  @ApiQuery({ name: 'from', required: true, type: String, description: 'Source currency code (e.g., USD)' })
  @ApiQuery({ name: 'to', required: true, type: String, description: 'Target currency code (e.g., GBP)' })
  @SwaggerApiResponse({ status: 200, description: 'Currency converted successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid currency codes or amount' })
  async convert(
    @Query('amount') amount: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<ApiResponse<{ amount: number; from: string; to: string; converted: number }>> {
    const amountNum = parseFloat(amount);
    const converted = await this.currencyService.convertBetween(amountNum, from, to);

    return {
      data: {
        amount: amountNum,
        from,
        to,
        converted,
      },
      message: 'Currency converted successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('user-currency')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get user currency preference',
    description: 'Retrieves the authenticated user\'s preferred currency.',
  })
  @SwaggerApiResponse({ status: 200, description: 'User currency retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserCurrency(@Request() req: any): Promise<ApiResponse<any>> {
    const result = await this.currencyService.getUserCurrency(req.user.id);
    return {
      data: result,
      message: 'User currency retrieved successfully',
    };
  }
}

