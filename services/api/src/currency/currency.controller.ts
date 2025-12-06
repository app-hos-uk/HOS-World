import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Public()
  @Get('rates')
  async getRates(): Promise<ApiResponse<Record<string, number>>> {
    const rates = await this.currencyService.getAllRates();
    return {
      data: rates,
      message: 'Exchange rates retrieved successfully',
    };
  }

  @Public()
  @Get('convert')
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
  async getUserCurrency(@Request() req: any): Promise<ApiResponse<any>> {
    const result = await this.currencyService.getUserCurrency(req.user.id);
    return {
      data: result,
      message: 'User currency retrieved successfully',
    };
  }
}

