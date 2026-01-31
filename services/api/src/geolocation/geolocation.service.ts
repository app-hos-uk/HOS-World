import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

interface CountryInfo {
  country: string;
  countryCode: string;
  currency: string;
  timezone?: string;
}

@Injectable()
export class GeolocationService {
  private readonly logger = new Logger(GeolocationService.name);
  private readonly apiUrl = 'https://ipapi.co';

  // Country to currency mapping
  private readonly countryCurrencyMap: Record<string, string> = {
    GB: 'GBP',
    US: 'USD',
    CA: 'USD', // Canada uses USD for e-commerce often
    AU: 'USD', // Australia
    EU: 'EUR',
    DE: 'EUR', // Germany
    FR: 'EUR', // France
    IT: 'EUR', // Italy
    ES: 'EUR', // Spain
    NL: 'EUR', // Netherlands
    BE: 'EUR', // Belgium
    AT: 'EUR', // Austria
    PT: 'EUR', // Portugal
    IE: 'EUR', // Ireland
    GR: 'EUR', // Greece
    FI: 'EUR', // Finland
    AE: 'AED', // UAE
    SA: 'AED', // Saudi Arabia (often uses AED)
    KW: 'AED', // Kuwait
    QA: 'AED', // Qatar
    BH: 'AED', // Bahrain
    OM: 'AED', // Oman
  };

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Detect country from IP address
   */
  async detectCountryFromIP(ipAddress: string): Promise<CountryInfo | null> {
    try {
      // Remove port if present
      const cleanIP = ipAddress.split(':')[0];

      // Skip localhost/private IPs
      if (
        cleanIP === '127.0.0.1' ||
        cleanIP === '::1' ||
        cleanIP.startsWith('192.168.') ||
        cleanIP.startsWith('10.') ||
        cleanIP.startsWith('172.')
      ) {
        this.logger.debug('Local/private IP detected, using default');
        return this.getDefaultCountry();
      }

      const url = `${this.apiUrl}/${cleanIP}/json/`;
      const response = await fetch(url);

      if (!response.ok) {
        this.logger.warn(`IP detection API returned status ${response.status}`);
        return this.getDefaultCountry();
      }

      const data = await response.json();

      if (data.error) {
        this.logger.warn(`IP detection error: ${data.reason}`);
        return this.getDefaultCountry();
      }

      const countryCode = data.country_code || 'GB';
      const country = data.country_name || 'United Kingdom';
      const currency = this.countryCurrencyMap[countryCode] || 'GBP';

      return {
        country,
        countryCode,
        currency,
        timezone: data.timezone,
      };
    } catch (error) {
      this.logger.error(`Error detecting country from IP: ${error.message}`);
      return this.getDefaultCountry();
    }
  }

  /**
   * Get currency for a country
   */
  getCurrencyForCountry(countryCode: string): string {
    return this.countryCurrencyMap[countryCode] || 'GBP';
  }

  /**
   * Get country name from code
   */
  getCountryName(countryCode: string): string {
    const countryNames: Record<string, string> = {
      GB: 'United Kingdom',
      US: 'United States',
      CA: 'Canada',
      AU: 'Australia',
      DE: 'Germany',
      FR: 'France',
      IT: 'Italy',
      ES: 'Spain',
      NL: 'Netherlands',
      BE: 'Belgium',
      AT: 'Austria',
      PT: 'Portugal',
      IE: 'Ireland',
      GR: 'Greece',
      FI: 'Finland',
      AE: 'United Arab Emirates',
      SA: 'Saudi Arabia',
      KW: 'Kuwait',
      QA: 'Qatar',
      BH: 'Bahrain',
      OM: 'Oman',
    };

    return countryNames[countryCode] || countryCode;
  }

  /**
   * Update user's country and currency based on IP
   */
  async updateUserCountryFromIP(userId: string, ipAddress: string): Promise<void> {
    const countryInfo = await this.detectCountryFromIP(ipAddress);

    if (countryInfo) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          country: countryInfo.country,
          currencyPreference: countryInfo.currency,
          ipAddress,
          countryDetectedAt: new Date(),
        },
      });
    }
  }

  /**
   * Get default country (fallback)
   */
  private getDefaultCountry(): CountryInfo {
    return {
      country: 'United Kingdom',
      countryCode: 'GB',
      currency: 'GBP',
      timezone: 'Europe/London',
    };
  }
}
