import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrencyService } from './currency.service';
import { Public } from '@hos-marketplace/auth-common';

@ApiTags('currency')
@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Public()
  @Get()
  async getAllCurrencies() { return { data: await this.currencyService.getAllCurrencies(), message: 'Currencies retrieved' }; }

  @Public()
  @Get('rate')
  async getExchangeRate(@Query('from') from: string, @Query('to') to: string) {
    const rate = await this.currencyService.getExchangeRate(from, to);
    return { data: rate, message: rate ? 'Exchange rate retrieved' : 'Currency not found' };
  }

  @Public()
  @Get('convert')
  async convert(@Query('amount') amount: string, @Query('from') from: string, @Query('to') to: string) {
    const result = await this.currencyService.convertAmount(parseFloat(amount), from, to);
    return { data: result, message: result ? 'Conversion completed' : 'Conversion failed' };
  }
}
