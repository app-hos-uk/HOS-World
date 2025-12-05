'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { CharacterSelector } from '@/components/CharacterSelector';
import { FandomQuiz } from '@/components/FandomQuiz';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'login' | 'character' | 'quiz' | 'forgot-password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [showCharacterSelector, setShowCharacterSelector] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isMounted, setIsMounted] = useState(false); // Prevent hydration mismatches
  const hasCheckedAuth = useRef(false);
  const isRedirecting = useRef(false);
  const authCheckInProgress = useRef(false); // Prevent concurrent auth checks
  const authRequestController = useRef<AbortController | null>(null); // Track active request

  // Set mounted state after hydration to prevent server/client mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // CRITICAL: Only run auth check after component is mounted (client-side only)
    // This prevents hydration mismatches between server and client
    if (!isMounted) {
      return;
    }
    
    // CRITICAL: If we're already redirecting, don't check auth again
    // This prevents redirect loops and page instability
    if (isRedirecting.current) {
      setIsCheckingAuth(false);
      return;
    }
    
    // Prevent multiple effect runs
    // This can happen in React Strict Mode or with browser extensions
    if (hasCheckedAuth.current || authCheckInProgress.current) {
      return;
    }
    hasCheckedAuth.current = true;
    authCheckInProgress.current = true;
    
    // Reset redirect flag on mount to prevent stale state
    isRedirecting.current = false;

    // Add small delay to ensure DOM is ready
    // This helps with React hydration timing issues
    const checkAuth = async () => {
      try {
        // Small delay to stabilize
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // CRITICAL: Check if we're still on login page before proceeding
        // If user navigated away, don't check auth
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          console.log('Not on login page, skipping auth check');
          setIsCheckingAuth(false);
          authCheckInProgress.current = false;
          return;
        }

        // Chrome-specific: Use try-catch for localStorage access
        // Chrome extensions can sometimes interfere with localStorage
        let storedToken: string | null = null;
        try {
          storedToken = localStorage.getItem('auth_token');
        } catch (e) {
          // Chrome extension or privacy mode might block localStorage
          console.warn('localStorage access blocked:', e);
          setIsCheckingAuth(false);
          authCheckInProgress.current = false;
          return;
        }
        
        if (!storedToken) {
          // No token, stay on login page
          setIsCheckingAuth(false);
          authCheckInProgress.current = false;
          return;
        }

        // Validate token by checking current user
        // Use fetch directly to avoid triggering onUnauthorized redirect
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        
        // CRITICAL: Cancel any existing auth request to prevent duplicates
        if (authRequestController.current) {
          console.log('Cancelling previous auth request to prevent duplicates');
          authRequestController.current.abort();
        }
        
        // Create new abort controller for this request
        const controller = new AbortController();
        authRequestController.current = controller;
        const timeoutId = setTimeout(() => {
          if (authRequestController.current === controller) {
            controller.abort();
          }
        }, 5000); // 5 second timeout

        try {
          // CRITICAL: Double-check we're still on login page before making request
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            console.log('Navigated away from login, cancelling auth check');
            controller.abort();
            setIsCheckingAuth(false);
            authCheckInProgress.current = false;
            authRequestController.current = null;
            return;
          }

          const response = await fetch(`${apiUrl}/auth/me`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${storedToken}`,
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          
          // CRITICAL: Clear the controller reference if this is still the active request
          if (authRequestController.current === controller) {
            authRequestController.current = null;
          }

          // CRITICAL: Double-check we're still on login page before processing response
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            console.log('Not on login page anymore, ignoring auth response');
            setIsCheckingAuth(false);
            authCheckInProgress.current = false;
            return;
          }

          // CRITICAL: Only redirect if response is 200 OK AND we have valid user data
          if (response.ok && response.status === 200) {
            try {
              const data = await response.json();
              
              // Validate response structure
              if (!data || !data.data) {
                console.warn('Invalid API response structure:', data);
                throw new Error('Invalid response structure');
              }
              
              const user = data.data;
              
              // CRITICAL: Only redirect if we have a valid user with an ID
              // AND we're still on the login page
              // AND we haven't already set the redirect flag
              // AND component is fully mounted (hydration complete)
              if (
                isMounted &&
                user && 
                user.id && 
                typeof user.id === 'string' &&
                user.id.length > 0 &&
                !isRedirecting.current && 
                typeof window !== 'undefined' &&
                window.location.pathname === '/login'
              ) {
                console.log('Valid user found, redirecting to home:', user.email);
                
                // Set flags immediately to prevent any re-checks
                isRedirecting.current = true;
                setIsCheckingAuth(false);
                authCheckInProgress.current = false;
                hasCheckedAuth.current = true; // Prevent any future checks
                
                // Use immediate redirect with window.location for reliability
                // This ensures the redirect happens immediately and prevents any loops
                if (typeof window !== 'undefined' && window.location.pathname === '/login') {
                  // Clear any pending timeouts/animations
                  if (authRequestController.current) {
                    authRequestController.current.abort();
                    authRequestController.current = null;
                  }
                  
                  // Immediate redirect using window.location for maximum reliability
                  // This bypasses React Router and ensures the redirect completes
                  window.location.href = '/';
                  return;
                }
                
                // Fallback to router.replace if window.location fails
                router.replace('/');
                return;
              } else {
                console.warn('User validation failed:', {
                  hasUser: !!user,
                  hasId: !!(user && user.id),
                  idType: user?.id ? typeof user.id : 'none',
                  idLength: user?.id ? user.id.length : 0,
                  isRedirecting: isRedirecting.current,
                  pathname: window.location.pathname,
                });
              }
            } catch (parseError) {
              console.error('Failed to parse auth response:', parseError);
              // Don't redirect on parse errors
            }
          } else {
            // Response not OK - token is invalid
            console.log('Auth check failed - invalid token:', response.status, response.statusText);
          }
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          
          // Clear controller reference
          if (authRequestController.current === controller) {
            authRequestController.current = null;
          }
          
          // Handle abort errors gracefully (user navigated away or timeout)
          if (fetchError.name === 'AbortError') {
            // Check if we're still on login page
            if (typeof window !== 'undefined' && window.location.pathname === '/login') {
              console.warn('Auth check aborted - staying on login page');
            } else {
              console.log('Auth check aborted - user navigated away');
            }
            setIsCheckingAuth(false);
            authCheckInProgress.current = false;
            // Don't redirect on abort
            return;
          } else {
            console.error('Auth check error:', fetchError);
            // Don't redirect on errors
            throw fetchError;
          }
        }
        
        // If we get here, token is invalid (401, 403, or other error)
        // Clear invalid token and stay on login page
        try {
          localStorage.removeItem('auth_token');
        } catch (e) {
          console.warn('Failed to clear localStorage:', e);
        }
        setIsCheckingAuth(false);
        authCheckInProgress.current = false;
      } catch (error) {
        // Network error or other issue
        console.error('Auth check failed:', error);
        // Clear token on error to be safe
        try {
          localStorage.removeItem('auth_token');
        } catch (e) {
          console.warn('Failed to clear localStorage:', e);
        }
        // Stay on login page - don't redirect
        setIsCheckingAuth(false);
        authCheckInProgress.current = false;
      } finally {
        // Always reset the in-progress flag
        authCheckInProgress.current = false;
      }
    };

    checkAuth();
    
    // Cleanup function to reset flags and cancel requests if component unmounts
    return () => {
      authCheckInProgress.current = false;
      if (authRequestController.current) {
        console.log('Component unmounting, cancelling auth request');
        authRequestController.current.abort();
        authRequestController.current = null;
      }
    };
  }, [router, isMounted]); // Add isMounted to dependencies

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate inputs
    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      console.log('Attempting login with email:', email);
      const response = await apiClient.login({ email, password });
      console.log('Login response received:', response);
      console.log('Response structure:', {
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        hasToken: !!(response.data?.token),
        hasUser: !!(response.data?.user),
      });
      
      // Check response structure
      if (!response || !response.data) {
        console.error('Invalid response structure:', response);
        throw new Error('Invalid response from server');
      }

      const { token: authToken } = response.data;

      if (!authToken) {
        console.error('No token in response:', response);
        throw new Error('No token received from server');
      }

      // Chrome-specific: Ensure localStorage write completes
      try {
        localStorage.setItem('auth_token', authToken);
        setToken(authToken);
      } catch (e) {
        console.error('Failed to save token:', e);
        throw new Error('Failed to save authentication token');
      }

      // Character selection is optional - go directly to home page
      // Chrome-specific: Use setTimeout to ensure state updates complete before redirect
      setTimeout(() => {
        router.replace('/');
      }, 0);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please check your credentials.');
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.register({
        email,
        password,
        role: 'customer',
      });
      const { token: authToken } = response.data;

      // Chrome-specific: Ensure localStorage write completes
      try {
        localStorage.setItem('auth_token', authToken);
        setToken(authToken);
      } catch (e) {
        console.error('Failed to save token:', e);
        throw new Error('Failed to save authentication token');
      }

      // Character selection is optional - go directly to home page
      // New users can select a character later from their profile
      // Chrome-specific: Use setTimeout to ensure state updates complete
      setTimeout(() => {
        router.replace('/');
      }, 0);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCharacterSelected = async (characterId: string, favoriteFandoms: string[]) => {
    try {
      await apiClient.post('/auth/select-character', {
        characterId,
        favoriteFandoms,
      });

      // Show fandom quiz after character selection
      setSelectedCharacter(characterId);
      setStep('quiz');
    } catch (err: any) {
      setError(err.message || 'Failed to select character');
    }
  };

  const handleQuizComplete = async (quizData: { favoriteFandoms: string[]; interests: string[] }) => {
    try {
      await apiClient.post('/auth/fandom-quiz', quizData);
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Failed to save quiz results');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetLoading(true);
    setResetSuccess(false);

    try {
      // TODO: Connect to actual password reset endpoint when available
      // For now, show success message
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      setResetSuccess(true);
      setTimeout(() => {
        setStep('login');
        setResetEmail('');
        setResetSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  // Show loading state while checking authentication
  // Only show if we're actually checking, not redirecting, and component is mounted
  // This prevents hydration mismatch by not showing different content on server vs client
  if (!isMounted || (isCheckingAuth && !isRedirecting.current)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-sm sm:text-base text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        {/* Logo/Brand */}
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-purple-600 mb-1 sm:mb-2">House of Spells</h1>
          <p className="text-sm sm:text-base text-gray-600">Welcome to the magical marketplace</p>
        </div>

        {/* Character Selector */}
        {step === 'character' && (
          <CharacterSelector
            onSelect={handleCharacterSelected}
            onSkip={() => router.replace('/')}
          />
        )}

        {/* Fandom Quiz */}
        {step === 'quiz' && (
          <FandomQuiz
            onComplete={handleQuizComplete}
            onSkip={() => router.replace('/')}
          />
        )}

        {/* Forgot Password Form */}
        {step === 'forgot-password' && (
          <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-4 sm:mb-6">Reset Password</h2>

            {resetSuccess ? (
              <div className="text-center space-y-4">
                <div className="p-4 bg-green-100 text-green-700 rounded-lg">
                  <p className="font-semibold">Email sent!</p>
                  <p className="text-sm mt-1">
                    If an account exists with that email, you'll receive password reset instructions.
                  </p>
                </div>
                <p className="text-sm text-gray-600">Redirecting to login...</p>
              </div>
            ) : (
              <>
                <p className="text-gray-600 text-center mb-6">
                  Enter your email address and we'll send you a link to reset your password.
                </p>

                {error && (
                  <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="your.email@example.com"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    onClick={() => {
                      setStep('login');
                      setResetEmail('');
                      setError('');
                    }}
                    className="text-purple-600 hover:underline text-sm"
                  >
                    ← Back to Login
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Login/Register Form */}
        {step === 'login' && (
          <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-4 sm:mb-6">
              {isLogin ? 'Welcome Back!' : 'Join the Magic'}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="your.email@example.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => setStep('forgot-password')}
                      className="text-sm text-purple-600 hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : isLogin ? 'Login' : 'Create Account'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-purple-600 hover:underline text-sm"
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Login'}
              </button>
            </div>

            {/* Social Login */}
            <div className="mt-4 sm:mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-xs sm:text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                <button
                  onClick={() => window.location.href = '/api/auth/google'}
                  className="flex items-center justify-center px-2 sm:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs sm:text-sm font-medium">Google</span>
                </button>
                <button
                  onClick={() => window.location.href = '/api/auth/facebook'}
                  className="flex items-center justify-center px-2 sm:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs sm:text-sm font-medium">Facebook</span>
                </button>
                <button
                  onClick={() => window.location.href = '/api/auth/apple'}
                  className="flex items-center justify-center px-2 sm:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs sm:text-sm font-medium">Apple</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

