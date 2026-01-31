import { Injectable } from '@nestjs/common';

interface CountryRequirements {
  vatRate?: number;
  requiresAgeVerification?: boolean;
  minimumAge?: number;
  dataRetentionDays?: number;
  requiresCookieConsent?: boolean;
  paymentMethods?: string[];
  restrictions?: string[];
}

@Injectable()
export class ComplianceService {
  // Country-specific compliance requirements
  private readonly countryRequirements: Record<string, CountryRequirements> = {
    GB: {
      vatRate: 0.2, // 20% VAT
      requiresAgeVerification: false,
      dataRetentionDays: 2555, // 7 years for financial records
      requiresCookieConsent: true,
      paymentMethods: ['stripe', 'klarna'],
    },
    US: {
      vatRate: 0, // Sales tax varies by state
      requiresAgeVerification: false,
      dataRetentionDays: 2555, // 7 years
      requiresCookieConsent: false, // Varies by state (CCPA)
      paymentMethods: ['stripe', 'klarna'],
    },
    DE: {
      vatRate: 0.19, // 19% VAT
      requiresAgeVerification: false,
      dataRetentionDays: 1825, // 5 years
      requiresCookieConsent: true,
      paymentMethods: ['stripe', 'klarna'],
    },
    FR: {
      vatRate: 0.2, // 20% VAT
      requiresAgeVerification: false,
      dataRetentionDays: 1825, // 5 years
      requiresCookieConsent: true,
      paymentMethods: ['stripe', 'klarna'],
    },
    AE: {
      vatRate: 0.05, // 5% VAT
      requiresAgeVerification: false,
      dataRetentionDays: 1825, // 5 years
      requiresCookieConsent: true,
      paymentMethods: ['stripe'],
    },
  };

  /**
   * Get compliance requirements for a country
   */
  getRequirements(countryCode: string): CountryRequirements {
    return (
      this.countryRequirements[countryCode] || {
        vatRate: 0,
        requiresAgeVerification: false,
        dataRetentionDays: 1825,
        requiresCookieConsent: true,
        paymentMethods: ['stripe'],
      }
    );
  }

  /**
   * Get VAT/tax rate for a country
   */
  getTaxRate(countryCode: string): number {
    const requirements = this.getRequirements(countryCode);
    return requirements.vatRate || 0;
  }

  /**
   * Check if age verification is required
   */
  requiresAgeVerification(countryCode: string): boolean {
    const requirements = this.getRequirements(countryCode);
    return requirements.requiresAgeVerification || false;
  }

  /**
   * Get data retention period in days
   */
  getDataRetentionDays(countryCode: string): number {
    const requirements = this.getRequirements(countryCode);
    return requirements.dataRetentionDays || 1825; // Default 5 years
  }

  /**
   * Get available payment methods for country
   */
  getPaymentMethods(countryCode: string): string[] {
    const requirements = this.getRequirements(countryCode);
    return requirements.paymentMethods || ['stripe'];
  }
}
