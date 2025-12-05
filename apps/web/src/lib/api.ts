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
      const unauthId = `unauth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const stackTrace = new Error().stack || '';
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/315c2d74-b9bb-430e-9c51-123c9436e40e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:66',message:'onUnauthorized triggered',data:{unauthId,currentPath,isInCooldown:isInLoginCooldown(),lastLoginTime,stackTrace:stackTrace.split('\n').slice(0,8).join('\n')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      console.log('[LOGIN FIX] onUnauthorized called', {
        currentPath,
        isInCooldown: isInLoginCooldown(),
        lastLoginTime,
        timestamp: Date.now(),
      });
      
      // CRITICAL: Don't redirect if we're already on login page
      if (currentPath === '/login' || currentPath.includes('/login')) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/315c2d74-b9bb-430e-9c51-123c9436e40e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:78',message:'onUnauthorized skipped - already on login',data:{unauthId,currentPath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        console.log('[LOGIN FIX] Already on login page, skipping redirect');
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
        console.log('[LOGIN FIX] Skipping redirect - within login cooldown period', {
          timeSinceLogin: Date.now() - (lastLoginTime || 0),
          cooldownMs: LOGIN_COOLDOWN_MS,
          currentPath,
        });
        // Don't clear token during cooldown - might be a false positive
        return;
      }
      
      // Clear token and redirect to login
      try {
        localStorage.removeItem('auth_token');
        // Clear login time on unauthorized
        lastLoginTime = null;
        sessionStorage.removeItem('last_login_time');
        console.log('[LOGIN FIX] Token cleared, redirecting to /login');
      } catch (e) {
        console.warn('[LOGIN FIX] Failed to clear localStorage:', e);
      }
      
      // Only redirect if we're not on login page and not in cooldown
      if (currentPath !== '/login' && !currentPath.includes('/login')) {
        try {
          console.log('[LOGIN FIX] Redirecting to /login from:', currentPath);
          window.location.href = '/login';
        } catch (e) {
          console.error('[LOGIN FIX] Failed to redirect:', e);
        }
      }
    }
  },
});


