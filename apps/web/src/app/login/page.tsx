'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, markLoginSuccess } from '@/lib/api';
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
  const [isCheckingAuth, setIsCheckingAuth] = useState(false); // Disabled for stability
  const [isMounted, setIsMounted] = useState(false); // Prevent hydration mismatches
  const hasCheckedAuth = useRef(false);
  const isRedirecting = useRef(false);
  const authCheckInProgress = useRef(false); // Prevent concurrent auth checks
  const authRequestController = useRef<AbortController | null>(null); // Track active request

  // Set mounted state after hydration to prevent server/client mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // CRITICAL: Cancel any auth checks immediately when user starts logging in
  useEffect(() => {
    if (loading) {
      // User is actively logging in - cancel any pending auth checks
      const controller = authRequestController.current;
      if (controller) {
        controller.abort();
        authRequestController.current = null;
      }
      // Prevent auth check from running during login
      isRedirecting.current = false;
      hasCheckedAuth.current = false;
      authCheckInProgress.current = false;
      setIsCheckingAuth(false);
    }
  }, [loading]);



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // CRITICAL: Cancel any pending auth checks immediately
    const loginController = authRequestController.current;
    if (loginController) {
      loginController.abort();
      authRequestController.current = null;
    }
    
    // Set flags to prevent auth check from running during login
    isRedirecting.current = false;
    hasCheckedAuth.current = false;
    authCheckInProgress.current = false;
    setIsCheckingAuth(false);
    
    // Clear any sessionStorage flags
    try {
      sessionStorage.removeItem('login_redirecting');
    } catch (e) {
      // Ignore
    }

    // Validate inputs
    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.login({ email, password });
      
      // Check response structure
      if (!response || !response.data) {
        throw new Error('Invalid response from server');
      }

      const { token: authToken } = response.data;

      if (!authToken) {
        throw new Error('No token received from server');
      }

      // Save token to localStorage
      try {
        localStorage.setItem('auth_token', authToken);
        setToken(authToken);
      } catch (e) {
        console.error('Failed to save token:', e);
        throw new Error('Failed to save authentication token');
      }

      // Mark login success to prevent onUnauthorized redirects
      markLoginSuccess();

      // Fetch user data to get role for redirect
      let redirectPath = '/';
      try {
        const userResponse = await apiClient.get('/auth/me');
        if (userResponse?.data) {
          const user = userResponse.data;
          // Map role to dashboard path
          const roleDashboardMap: Record<string, string> = {
            CUSTOMER: '/',
            WHOLESALER: '/wholesaler/dashboard',
            B2C_SELLER: '/seller/dashboard',
            SELLER: '/seller/dashboard',
            ADMIN: '/admin/dashboard',
            PROCUREMENT: '/procurement/dashboard',
            FULFILLMENT: '/fulfillment/dashboard',
            CATALOG: '/catalog/dashboard',
            MARKETING: '/marketing/dashboard',
            FINANCE: '/finance/dashboard',
            CMS_EDITOR: '/',
          };
          redirectPath = roleDashboardMap[user.role] || '/';
        }
      } catch (err) {
        // If we can't get user info, default to home
        console.error('Failed to fetch user info:', err);
      }

      // Set redirect flag and stop auth check BEFORE redirect
      isRedirecting.current = true;
      setIsCheckingAuth(false);
      setLoading(false);
      
      // Cancel any auth requests
      const controller = authRequestController.current;
      if (controller) {
        controller.abort();
        authRequestController.current = null;
      }

      // Redirect to role-specific dashboard or home
      if (typeof window !== 'undefined') {
        window.location.replace(redirectPath);
      } else {
        router.replace(redirectPath);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please check your credentials.');
      setLoading(false);
      // Reset flags on error so user can try again
      isRedirecting.current = false;
      hasCheckedAuth.current = false;
      authCheckInProgress.current = false;
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // CRITICAL: Cancel any pending auth checks immediately
    const registerController = authRequestController.current;
    if (registerController) {
      registerController.abort();
      authRequestController.current = null;
    }
    
    // Set flags to prevent auth check from running during registration
    isRedirecting.current = false;
    hasCheckedAuth.current = false;
    authCheckInProgress.current = false;
    setIsCheckingAuth(false);
    
    // Clear any sessionStorage flags
    try {
      sessionStorage.removeItem('login_redirecting');
    } catch (e) {
      // Ignore
    }

    try {
      const response = await apiClient.register({
        email,
        password,
        role: 'customer',
      });
      const { token: authToken } = response.data;

      // Save token to localStorage
      try {
        localStorage.setItem('auth_token', authToken);
        setToken(authToken);
      } catch (e) {
        console.error('Failed to save token:', e);
        throw new Error('Failed to save authentication token');
      }

      // CRITICAL: Mark login success to prevent onUnauthorized redirects
      markLoginSuccess();

      // CRITICAL: Set redirect flag and stop auth check BEFORE redirect
      isRedirecting.current = true;
      setIsCheckingAuth(false);
      setLoading(false);
      
      // Cancel any auth requests
      const controller = authRequestController.current;
      if (controller) {
        controller.abort();
        authRequestController.current = null;
      }

      if (typeof window !== 'undefined') {
        window.location.replace('/');
      } else {
        router.replace('/');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
      setLoading(false);
      // Reset flags on error so user can try again
      isRedirecting.current = false;
      hasCheckedAuth.current = false;
      authCheckInProgress.current = false;
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

  // Show minimal loading only during hydration
  // Once mounted, show login form immediately for maximum stability
  if (!isMounted) {
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

