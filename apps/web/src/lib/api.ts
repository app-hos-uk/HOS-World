import { ApiClient } from '@hos-marketplace/api-client';
import { getPublicApiBaseUrl } from './apiBaseUrl';

const API_BASE_URL = getPublicApiBaseUrl();

// Track login state to prevent redirect loops
let lastLoginTime: number | null = null;
const LOGIN_COOLDOWN_MS = 5000; // 5 seconds after login before allowing redirects

// Function to check if we're in the login cooldown period
const isInLoginCooldown = (): boolean => {
  if (!lastLoginTime) return false;
  const timeSinceLogin = Date.now() - lastLoginTime;
  return timeSinceLogin < LOGIN_COOLDOWN_MS;
};

// Function to mark successful login
export const markLoginSuccess = (): void => {
  if (typeof window !== 'undefined') {
    lastLoginTime = Date.now();
    // Also store in sessionStorage as backup
    try {
      sessionStorage.setItem('last_login_time', lastLoginTime.toString());
    } catch (e) {
      // Ignore sessionStorage errors
    }
  }
};

// Initialize lastLoginTime from sessionStorage if available
if (typeof window !== 'undefined') {
  try {
    const stored = sessionStorage.getItem('last_login_time');
    if (stored) {
      const storedTime = parseInt(stored, 10);
      const timeSinceLogin = Date.now() - storedTime;
      // Only use if less than cooldown period (fresh login)
      if (timeSinceLogin < LOGIN_COOLDOWN_MS) {
        lastLoginTime = storedTime;
      } else {
        sessionStorage.removeItem('last_login_time');
      }
    }
  } catch (e) {
    // Ignore sessionStorage errors
  }
}

export const apiClient = ApiClient.create({
  baseUrl: API_BASE_URL,
  getToken: () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  },
  onUnauthorized: () => {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      
      // Public pages that should never redirect to login
      const publicPages = ['/', '/products', '/fandoms', '/sellers', '/help', '/shipping', '/returns', '/privacy-policy'];
      const isPublicPage = publicPages.includes(currentPath) || 
                          currentPath.startsWith('/products/') ||
                          currentPath.startsWith('/fandoms/') ||
                          currentPath.startsWith('/sellers/');
      
      if (isPublicPage) {
        try {
          localStorage.removeItem('auth_token');
          document.cookie = 'is_logged_in=; path=/; max-age=0';
        } catch (e) {
          // Ignore
        }
        return;
      }
      
      if (currentPath === '/login' || currentPath.includes('/login')) {
        try {
          localStorage.removeItem('auth_token');
          document.cookie = 'is_logged_in=; path=/; max-age=0';
        } catch (e) {
          // Ignore
        }
        return;
      }
      
      // Don't redirect if we just logged in (within cooldown period)
      // This prevents redirect loops immediately after login
      if (isInLoginCooldown()) {
        // Don't clear token during cooldown - might be a false positive
        return;
      }
      
      try {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        // Clear the non-HttpOnly session indicator cookie
        document.cookie = 'is_logged_in=; path=/; max-age=0';
        lastLoginTime = null;
        sessionStorage.removeItem('last_login_time');
      } catch (e) {
        // Ignore localStorage errors
      }
      
      // Only redirect if we're not on login page, not on public page, and not in cooldown
      if (currentPath !== '/login' && !currentPath.includes('/login') && !isPublicPage) {
        try {
          window.location.href = '/login';
        } catch (e) {
          // Ignore redirect errors
        }
      }
    }
  },
});

/** localStorage key for anonymous cart session (X-Guest-Session). */
export const GUEST_CART_SESSION_KEY = 'hos_guest_cart_session';

export function getOrCreateGuestCartSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(GUEST_CART_SESSION_KEY);
  if (!id || id.length < 8) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_CART_SESSION_KEY, id);
  }
  return id;
}

export function clearGuestCartSessionId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(GUEST_CART_SESSION_KEY);
  }
}

/** Call after storing auth token to merge guest cart into user cart. */
export async function mergeGuestCartAfterAuth(): Promise<void> {
  if (typeof window === 'undefined') return;
  const guestSid = localStorage.getItem(GUEST_CART_SESSION_KEY);
  if (!guestSid) return;
  try {
    await apiClient.mergeGuestCart(guestSid);
    localStorage.removeItem(GUEST_CART_SESSION_KEY);
  } catch (e) {
    console.warn('Guest cart merge failed – session kept for retry', e);
  }
}


