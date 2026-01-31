import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.exchangerate-api.com/v4/latest';
  private readonly baseCurrency = 'GBP';
  private readonly supportedCurrencies = ['GBP', 'USD', 'EUR', 'AED'];
  private readonly cacheKeyPrefix = 'currency_rate:';
  private readonly cacheDuration = 3600; // 1 hour in seconds

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('EXCHANGE_RATE_API_KEY') || '';
  }

  /**
   * Get exchange rate for a currency pair
   */
  async getExchangeRate(targetCurrency: string): Promise<number> {
    if (targetCurrency === this.baseCurrency) {
      return 1;
    }

    if (!this.supportedCurrencies.includes(targetCurrency)) {
      throw new Error(`Unsupported currency: ${targetCurrency}`);
    }

    // Check cache first
    const cacheKey = `${this.cacheKeyPrefix}${this.baseCurrency}_${targetCurrency}`;
    const cachedRate = await this.cache.get<number>(cacheKey);

    if (cachedRate) {
      this.logger.debug(`Using cached rate for ${targetCurrency}: ${cachedRate}`);
      return cachedRate;
    }

    // Check database
    const dbRate = await this.prisma.currencyExchangeRate.findUnique({
      where: {
        baseCurrency_targetCurrency: {
          baseCurrency: this.baseCurrency,
          targetCurrency,
        },
      },
    });

    if (dbRate && dbRate.expiresAt > new Date()) {
      // Cache is still valid
      await this.cache.set(cacheKey, Number(dbRate.rate), this.cacheDuration);
      return Number(dbRate.rate);
    }

    // Fetch from API
    try {
      const rate = await this.fetchRateFromAPI(targetCurrency);

      // Update database
      const expiresAt = new Date(Date.now() + this.cacheDuration * 1000);
      await this.prisma.currencyExchangeRate.upsert({
        where: {
          baseCurrency_targetCurrency: {
            baseCurrency: this.baseCurrency,
            targetCurrency,
          },
        },
        create: {
          baseCurrency: this.baseCurrency,
          targetCurrency,
          rate,
          expiresAt,
        },
        update: {
          rate,
          cachedAt: new Date(),
          expiresAt,
        },
      });

      // Cache the rate
      await this.cache.set(cacheKey, rate, this.cacheDuration);

      return rate;
    } catch (error) {
      this.logger.error(`Failed to fetch rate from API: ${error.message}`);

      // Fallback to database rate even if expired
      if (dbRate) {
        this.logger.warn(`Using expired database rate for ${targetCurrency}`);
        return Number(dbRate.rate);
      }

      // Last resort: return default rates (should be updated regularly)
      return this.getDefaultRate(targetCurrency);
    }
  }

  /**
   * Get all exchange rates
   */
  async getAllRates(): Promise<Record<string, number>> {
    const rates: Record<string, number> = {};

    for (const currency of this.supportedCurrencies) {
      rates[currency] = await this.getExchangeRate(currency);
    }

    return rates;
  }

  /**
   * Convert amount from base currency to target currency
   */
  async convert(amount: number, targetCurrency: string): Promise<number> {
    if (targetCurrency === this.baseCurrency) {
      return amount;
    }

    const rate = await this.getExchangeRate(targetCurrency);
    return amount * rate;
  }

  /**
   * Convert amount between any two currencies
   */
  async convertBetween(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    // Convert to base currency first, then to target
    if (fromCurrency !== this.baseCurrency) {
      const fromRate = await this.getExchangeRate(fromCurrency);
      amount = amount / fromRate; // Convert to base
    }

    if (toCurrency !== this.baseCurrency) {
      const toRate = await this.getExchangeRate(toCurrency);
      amount = amount * toRate; // Convert from base to target
    }

    return amount;
  }

  /**
   * Fetch rate from ExchangeRate-API
   */
  private async fetchRateFromAPI(targetCurrency: string): Promise<number> {
    try {
      const url = `${this.baseUrl}/${this.baseCurrency}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json();

      if (!data.rates || !data.rates[targetCurrency]) {
        throw new Error(`Rate not found for ${targetCurrency}`);
      }

      return data.rates[targetCurrency];
    } catch (error) {
      this.logger.error(`Error fetching rate from API: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get default rate (fallback when API fails)
   */
  private getDefaultRate(targetCurrency: string): number {
    const defaultRates: Record<string, number> = {
      USD: 1.27, // Approximate GBP to USD
      EUR: 1.17, // Approximate GBP to EUR
      AED: 4.67, // Approximate GBP to AED
    };

    return defaultRates[targetCurrency] || 1;
  }

  /**
   * Get user's preferred currency with rates
   */
  async getUserCurrency(userId: string): Promise<{
    currency: string;
    rates: Record<string, number>;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currencyPreference: true },
    });

    const currency = user?.currencyPreference || this.baseCurrency;
    const rates = await this.getAllRates();

    return { currency, rates };
  }

  /**
   * Update exchange rates (can be called by cron job)
   */
  async updateRates(): Promise<void> {
    this.logger.log('Updating exchange rates...');

    for (const currency of this.supportedCurrencies) {
      if (currency !== this.baseCurrency) {
        try {
          await this.getExchangeRate(currency);
        } catch (error) {
          this.logger.error(`Failed to update rate for ${currency}: ${error.message}`);
        }
      }
    }

    this.logger.log('Exchange rates updated');
  }
}
