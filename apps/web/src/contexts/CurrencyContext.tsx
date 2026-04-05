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
  const [currency, setCurrencyState] = useState<string>('USD');
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

      const isLoggedIn =
        typeof window !== 'undefined'
          ? (() => {
              try {
                return localStorage.getItem('auth_token') || document.cookie.includes('is_logged_in=true');
              } catch {
                return false;
              }
            })()
          : false;

      if (isLoggedIn && !isAuthFlowPage) {
        // Try to get user's currency preference
        const userCurrencyResponse = await apiClient.getUserCurrency();
        if (userCurrencyResponse?.data) {
          setCurrencyState(userCurrencyResponse.data.currency || 'USD');
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
        USD: 1,
        EUR: 0.92,
        AED: 3.67,
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
      const isLoggedIn =
        typeof window !== 'undefined'
          ? (() => {
              try {
                return localStorage.getItem('auth_token') || document.cookie.includes('is_logged_in=true');
              } catch {
                return false;
              }
            })()
          : false;
      if (!isLoggedIn) return;

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
    (amount: number, fromCurrency: string = 'USD'): number => {
      if (fromCurrency === currency) {
        return amount;
      }

      if (!rates[fromCurrency] || !rates[currency]) {
        return amount; // Fallback to original amount if rates not available
      }

      // Convert from source currency to USD (base), then to target currency
      const amountInUSD = amount / rates[fromCurrency];
      return amountInUSD * rates[currency];
    },
    [currency, rates]
  );

  const formatPrice = useCallback(
    (amount: number, fromCurrency: string = 'USD'): string => {
      const convertedAmount = convertPrice(amount, fromCurrency);
      const safeAmount = typeof convertedAmount === 'number' && !Number.isNaN(convertedAmount) ? convertedAmount : 0;
      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(safeAmount);
      } catch {
        const symbol = getCurrencySymbol(currency);
        return `${symbol}${safeAmount.toFixed(2)}`;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currency, convertPrice]
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

