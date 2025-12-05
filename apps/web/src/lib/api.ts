import { ApiClient } from '@hos-marketplace/api-client';

// Create API client instance
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Log API URL in development to help debug
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('API Base URL:', API_BASE_URL);
}

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
      
      // CRITICAL: Don't redirect if we're already on login page
      if (currentPath === '/login' || currentPath.includes('/login')) {
        // Just clear the token, don't redirect
        try {
          localStorage.removeItem('auth_token');
        } catch (e) {
          // Ignore
        }
        return;
      }
      
      // CRITICAL: Don't redirect if we just logged in (within cooldown period)
      // This prevents redirect loops immediately after login
      if (isInLoginCooldown()) {
        console.log('Skipping redirect - within login cooldown period');
        // Don't clear token during cooldown - might be a false positive
        return;
      }
      
      // Clear token and redirect to login
      try {
        localStorage.removeItem('auth_token');
        // Clear login time on unauthorized
        lastLoginTime = null;
        sessionStorage.removeItem('last_login_time');
      } catch (e) {
        console.warn('Failed to clear localStorage:', e);
      }
      
      // Only redirect if we're not on login page and not in cooldown
      if (currentPath !== '/login' && !currentPath.includes('/login')) {
        try {
          window.location.href = '/login';
        } catch (e) {
          // Fallback - ignore errors
        }
      }
    }
  },
});


