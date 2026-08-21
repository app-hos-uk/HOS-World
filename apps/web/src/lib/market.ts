const STORAGE_KEY = 'hos_market_code';

export function getStoredMarketCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredMarketCode(code: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (code) window.localStorage.setItem(STORAGE_KEY, code);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
