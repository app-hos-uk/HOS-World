import { ApiClient } from '@hos-marketplace/api-client';

// Create API client instance
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Log API URL in development to help debug
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('API Base URL:', API_BASE_URL);
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
      try {
        localStorage.removeItem('auth_token');
      } catch (e) {
        console.warn('Failed to clear localStorage:', e);
      }
      
      // Chrome-specific: Double-check pathname to prevent redirect loops
      // Chrome can sometimes have stale pathname values
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && !currentPath.includes('/login')) {
        // Chrome-specific: Use replaceState to prevent back button issues
        // Then navigate to avoid redirect loops
        try {
          window.history.replaceState(null, '', '/login');
          // Small delay to ensure state is updated
          setTimeout(() => {
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
          }, 0);
        } catch (e) {
          // Fallback to direct navigation
          window.location.href = '/login';
        }
      }
    }
  },
});


