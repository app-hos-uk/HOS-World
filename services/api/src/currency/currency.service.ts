import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FeatureFlagsService, FeatureFlag } from '../config/feature-flags.service';
import { PlatformRegionService } from '../config/platform-region.service';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from '../cache/cache.service';

/** Full multi-currency catalog; launch restricts to the region currency unless overridden. */
export const GLOBAL_CURRENCY_CODES = [
  'USD',
  'EUR',
  'GBP',
  'AED',
  'JPY',
  'AUD',
  'CAD',
  'SGD',
] as const;

@Injectable()
export class CurrencyService implements OnModuleInit {
  private readonly logger = new Logger(CurrencyService.name);
  private readonly apiKey: string;
  private readonly openBaseUrl = 'https://api.exchangerate-api.com/v4/latest';
  private baseCurrency = 'USD';
  private supportedCurrencies: string[] = ['USD'];
  private readonly cacheKeyPrefix = 'currency_rate:';
  private readonly cacheDuration = 3600; // 1 hour in seconds

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private configService: ConfigService,
    private platformRegion: PlatformRegionService,
    private featureFlags: FeatureFlagsService,
  ) {
    this.apiKey = this.configService.get<string>('EXCHANGE_RATE_API_KEY') || '';
    const envBase = this.configService.get<string>('PLATFORM_CURRENCY')?.trim().toUpperCase();
    if (envBase) this.baseCurrency = envBase;
    this.rebuildSupportedCurrencies();
  }

  async onModuleInit() {
    this.baseCurrency = await this.platformRegion.getCurrency();
    this.rebuildSupportedCurrencies();
  }

  /**
   * Launch: region currency only.
   * Re-enable broader FX via FF_MULTI_CURRENCY=true or GLOBAL_SUPPORTED_CURRENCIES.
   */
  private rebuildSupportedCurrencies(): void {
    const raw = this.configService.get<string>('GLOBAL_SUPPORTED_CURRENCIES', '');
    const parsed = raw
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    let list: string[];
    if (parsed.length) {
      list = parsed;
    } else if (this.featureFlags.isEnabled(FeatureFlag.MULTI_CURRENCY)) {
      list = [...GLOBAL_CURRENCY_CODES];
    } else {
      list = [this.baseCurrency];
    }

    this.supportedCurrencies = [...new Set([this.baseCurrency, ...list])];
  }

  getBaseCurrency(): string {
    return this.baseCurrency;
  }

  getSupportedCurrencies(): string[] {
    // Rebuild so late feature-flag changes (admin toggle) take effect without restart.
    this.rebuildSupportedCurrencies();
    return [...this.supportedCurrencies];
  }

  isMultiCurrencyEnabled(): boolean {
    const raw = this.configService.get<string>('GLOBAL_SUPPORTED_CURRENCIES', '');
    const hasOverride = raw
      .split(',')
      .map((c) => c.trim())
      .some(Boolean);
    return hasOverride || this.featureFlags.isEnabled(FeatureFlag.MULTI_CURRENCY);
  }

  /**
   * Get exchange rate for a currency pair
   */
  async getExchangeRate(targetCurrency: string): Promise<number> {
    this.rebuildSupportedCurrencies();

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

    for (const currency of this.getSupportedCurrencies()) {
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

    if (!this.isMultiCurrencyEnabled()) {
      throw new Error(
        'Multi-currency conversion is disabled. Set FF_MULTI_CURRENCY=true or GLOBAL_SUPPORTED_CURRENCIES to enable.',
      );
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
   * Fetch rate from ExchangeRate-API.
   * Uses authenticated v6 when EXCHANGE_RATE_API_KEY is set; otherwise open v4.
   */
  private async fetchRateFromAPI(targetCurrency: string): Promise<number> {
    try {
      const url = this.apiKey
        ? `https://v6.exchangerate-api.com/v6/${this.apiKey}/latest/${this.baseCurrency}`
        : `${this.openBaseUrl}/${this.baseCurrency}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json();
      const rates = data.conversion_rates || data.rates;

      if (!rates || rates[targetCurrency] == null) {
        throw new Error(`Rate not found for ${targetCurrency}`);
      }

      return rates[targetCurrency];
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
      GBP: 0.79,
      EUR: 0.92,
      AED: 3.67,
      JPY: 149.5,
      AUD: 1.53,
      CAD: 1.36,
      SGD: 1.34,
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

    for (const currency of this.getSupportedCurrencies()) {
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
