import { Injectable, Logger } from '@nestjs/common';
import { PaymentPrismaService } from '../database/prisma.service';

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  constructor(private prisma: PaymentPrismaService) {}

  async getAllCurrencies() {
    return this.prisma.currency.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
  }

  async getExchangeRate(from: string, to: string) {
    const [fromCurrency, toCurrency] = await Promise.all([
      this.prisma.currency.findUnique({ where: { code: from } }),
      this.prisma.currency.findUnique({ where: { code: to } }),
    ]);
    if (!fromCurrency || !toCurrency) return null;
    const rate = Number(toCurrency.exchangeRate) / Number(fromCurrency.exchangeRate);
    return { from, to, rate };
  }

  async convertAmount(amount: number, from: string, to: string) {
    const exchange = await this.getExchangeRate(from, to);
    if (!exchange) return null;
    return { amount, from, to, convertedAmount: amount * exchange.rate, rate: exchange.rate };
  }
}
