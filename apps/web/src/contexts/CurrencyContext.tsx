'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname();
  const lastPathnameRef = useRef<string | null>(null);

  const loadCurrencyData = useCallback(async () => {
    try {
      setLoading(true);
      // Only call the authenticated endpoint when we actually have a token.
      // This avoids noisy 401s on public pages like /login.
      const isAuthFlowPage =
        typeof window !== 'undefined' &&
        (pathname === '/login' || pathname.startsWith('/login') || pathname.startsWith('/auth/callback'));

      const token =
        typeof window !== 'undefined'
          ? (() => {
              try {
                return localStorage.getItem('auth_token');
              } catch {
                return null;
              }
            })()
          : null;

      if (token && !isAuthFlowPage) {
        // Try to get user's currency preference
        const userCurrencyResponse = await apiClient.getUserCurrency();
        if (userCurrencyResponse?.data) {
          setCurrencyState(userCurrencyResponse.data.currency || 'GBP');
          setRates(userCurrencyResponse.data.rates || {});
          return;
        }
      }

      // Guest / fallback: use public rates + saved preference
      const ratesResponse = await apiClient.getCurrencyRates();
      if (ratesResponse?.data) {
        setRates(ratesResponse.data);
      }
      if (typeof window !== 'undefined') {
        try {
          const savedCurrency = localStorage.getItem('currency_preference');
          if (savedCurrency) {
            setCurrencyState(savedCurrency);
          }
        } catch {
          // ignore
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
  }, [pathname]);

  // Load user's currency preference and rates
  // Re-run when pathname changes to ensure we use the current pathname value
  useEffect(() => {
    // Only reload if pathname actually changed (avoid duplicate calls on same route)
    if (lastPathnameRef.current === pathname) return;
    lastPathnameRef.current = pathname;
    loadCurrencyData();
  }, [pathname, loadCurrencyData]);

  const updateCurrencyPreference = useCallback(async (newCurrency: string) => {
    try {
      // Update user profile only if logged in
      const token =
        typeof window !== 'undefined'
          ? (() => {
              try {
                return localStorage.getItem('auth_token');
              } catch {
                return null;
              }
            })()
          : null;
      if (!token) return;

      await apiClient.updateProfile({ currencyPreference: newCurrency });
    } catch (error) {
      // User not logged in or update failed - just save to localStorage
      console.error('Failed to update currency preference:', error);
    }
  }, []);

  const setCurrency = useCallback((newCurrency: string) => {
    setCurrencyState(newCurrency);
    localStorage.setItem('currency_preference', newCurrency);
    // Update user preference if logged in
    updateCurrencyPreference(newCurrency).catch(console.error);
  }, [updateCurrencyPreference]);

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
      
      // Format with appropriate decimal places - ensure convertedAmount is a number
      const safeAmount = typeof convertedAmount === 'number' && !Number.isNaN(convertedAmount) ? convertedAmount : 0;
      const formatted = safeAmount.toFixed(2);
      return `${symbol}${formatted}`;
    },
    [currency, convertPrice, rates]
  );

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

