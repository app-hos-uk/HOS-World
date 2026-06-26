'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const STORAGE_PREFIX = 'hos_secure_token_';

function readStoredToken(storageKey: string): string | null {
  try {
    return sessionStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

/**
 * Reads sensitive tokens from URL query params, stores them in sessionStorage,
 * and strips them from the address bar to reduce exposure in history/referrer/logs.
 */
export function useSecureUrlToken(paramName = 'token'): string | null {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const storageKey = `${STORAGE_PREFIX}${pathname}_${paramName}`;
  const urlToken = searchParams.get(paramName);
  const [token, setToken] = useState<string | null>(
    () => urlToken ?? readStoredToken(storageKey),
  );

  useEffect(() => {
    if (urlToken) {
      setToken(urlToken);
      try {
        sessionStorage.setItem(storageKey, urlToken);
      } catch {
        // sessionStorage unavailable — token remains in component state only
      }
      router.replace(pathname);
      return;
    }

    if (!token) {
      const stored = readStoredToken(storageKey);
      if (stored) {
        setToken(stored);
      }
    }
  }, [urlToken, router, pathname, storageKey, token]);

  return token;
}

/**
 * Same as useSecureUrlToken but for additional query params that should be stripped from URL.
 */
export function useSecureUrlParam(paramName: string): string | null {
  return useSecureUrlToken(paramName);
}
