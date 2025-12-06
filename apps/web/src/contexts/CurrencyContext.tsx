'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { getCurrencySymbol } from '@hos-marketplace/utils';

interface CurrencyContextType {
  currency: string;
  rates: Record<string, number>;
  loading: boolean;
  setCurrency: (currency: string) => void;
  convertPrice: (amount: number, fromCurrency?: string) => number;
  formatPrice: (amount: number, fromCurrency?: string) => string;
  updateCurrencyPreference: (currency: string) => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<string>('GBP');
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Load user's currency preference and rates
  useEffect(() => {
    loadCurrencyData();
  }, []);

  const loadCurrencyData = async () => {
    try {
      setLoading(true);
      // Try to get user's currency preference
      try {
        const userCurrencyResponse = await apiClient.getUserCurrency();
        if (userCurrencyResponse?.data) {
          setCurrencyState(userCurrencyResponse.data.currency || 'GBP');
          setRates(userCurrencyResponse.data.rates || {});
        } else {
          // Fallback to public rates
          const ratesResponse = await apiClient.getCurrencyRates();
          if (ratesResponse?.data) {
            setRates(ratesResponse.data);
          }
        }
      } catch (error) {
        // User not logged in, get public rates
        const ratesResponse = await apiClient.getCurrencyRates();
        if (ratesResponse?.data) {
          setRates(ratesResponse.data);
        }
        // Check localStorage for saved preference
        const savedCurrency = localStorage.getItem('currency_preference');
        if (savedCurrency) {
          setCurrencyState(savedCurrency);
        }
      }
    } catch (error) {
      console.error('Failed to load currency data:', error);
      // Set default rates
      setRates({
        GBP: 1,
        USD: 1.27,
        EUR: 1.17,
        AED: 4.67,
      });
    } finally {
      setLoading(false);
    }
  };

  const setCurrency = useCallback((newCurrency: string) => {
    setCurrencyState(newCurrency);
    localStorage.setItem('currency_preference', newCurrency);
    // Update user preference if logged in
    updateCurrencyPreference(newCurrency).catch(console.error);
  }, []);

  const convertPrice = useCallback(
    (amount: number, fromCurrency: string = 'GBP'): number => {
      if (fromCurrency === currency) {
        return amount;
      }

      if (!rates[fromCurrency] || !rates[currency]) {
        return amount; // Fallback to original amount if rates not available
      }

      // Convert from source currency to GBP (base), then to target currency
      const amountInGBP = amount / rates[fromCurrency];
      return amountInGBP * rates[currency];
    },
    [currency, rates]
  );

  const formatPrice = useCallback(
    (amount: number, fromCurrency: string = 'GBP'): string => {
      const convertedAmount = convertPrice(amount, fromCurrency);
      const symbol = getCurrencySymbol(currency);
      
      // Format with appropriate decimal places
      const formatted = convertedAmount.toFixed(2);
      return `${symbol}${formatted}`;
    },
    [currency, convertPrice]
  );

  const updateCurrencyPreference = async (newCurrency: string) => {
    try {
      // Update user profile if logged in
      await apiClient.updateProfile({ currencyPreference: newCurrency });
    } catch (error) {
      // User not logged in or update failed - just save to localStorage
      console.error('Failed to update currency preference:', error);
    }
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        rates,
        loading,
        setCurrency,
        convertPrice,
        formatPrice,
        updateCurrencyPreference,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}

