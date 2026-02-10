import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  private readonly countryCurrencyMap: Record<string, string> = {
    GB: 'GBP', US: 'USD', CA: 'USD', AU: 'USD',
    EU: 'EUR', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR',
    NL: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR', IE: 'EUR', GR: 'EUR', FI: 'EUR',
    AE: 'AED', SA: 'AED', KW: 'AED', QA: 'AED', BH: 'AED', OM: 'AED',
  };

  constructor(private configService: ConfigService) {}

  async detectCountryFromIP(ipAddress: string): Promise<CountryInfo | null> {
    try {
      const cleanIP = ipAddress.split(':')[0];
      if (
        cleanIP === '127.0.0.1' || cleanIP === '::1' ||
        cleanIP.startsWith('192.168.') || cleanIP.startsWith('10.') || cleanIP.startsWith('172.')
      ) {
        return this.getDefaultCountry();
      }

      const url = `${this.apiUrl}/${cleanIP}/json/`;
      const response = await fetch(url);
      if (!response.ok) return this.getDefaultCountry();

      const data = await response.json();
      if (data.error) return this.getDefaultCountry();

      const countryCode = data.country_code || 'GB';
      const country = data.country_name || 'United Kingdom';
      const currency = this.countryCurrencyMap[countryCode] || 'GBP';

      return { country, countryCode, currency, timezone: data.timezone };
    } catch (error: any) {
      this.logger.error(`Error detecting country from IP: ${error?.message}`);
      return this.getDefaultCountry();
    }
  }

  getCurrencyForCountry(countryCode: string): string {
    return this.countryCurrencyMap[countryCode] || 'GBP';
  }

  getCountryName(countryCode: string): string {
    const countryNames: Record<string, string> = {
      GB: 'United Kingdom', US: 'United States', CA: 'Canada', AU: 'Australia',
      DE: 'Germany', FR: 'France', IT: 'Italy', ES: 'Spain',
      NL: 'Netherlands', BE: 'Belgium', AT: 'Austria', PT: 'Portugal',
      IE: 'Ireland', GR: 'Greece', FI: 'Finland',
      AE: 'United Arab Emirates', SA: 'Saudi Arabia', KW: 'Kuwait',
      QA: 'Qatar', BH: 'Bahrain', OM: 'Oman',
    };
    return countryNames[countryCode] || countryCode;
  }

  private getDefaultCountry(): CountryInfo {
    return {
      country: 'United Kingdom',
      countryCode: 'GB',
      currency: 'GBP',
      timezone: 'Europe/London',
    };
  }
}
