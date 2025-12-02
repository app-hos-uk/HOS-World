'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { CharacterSelector } from '@/components/CharacterSelector';
import { FandomQuiz } from '@/components/FandomQuiz';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'login' | 'character' | 'quiz'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [showCharacterSelector, setShowCharacterSelector] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      // Check if character is selected
      checkCharacterSelection(storedToken);
    }
  }, []);

  const checkCharacterSelection = async (authToken: string) => {
    try {
      const response = await apiClient.getCurrentUser();
      const user = response.data;
      
      if (!user.characterAvatar) {
        // Show character selector if no character selected
        setShowCharacterSelector(true);
        setStep('character');
        setToken(authToken);
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Error checking character:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.login({ email, password });
      const { token: authToken } = response.data;

      localStorage.setItem('auth_token', authToken);
      setToken(authToken);

      // Check if character is selected
      await checkCharacterSelection(authToken);

      if (!showCharacterSelector) {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
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

      localStorage.setItem('auth_token', authToken);
      setToken(authToken);

      // Show character selector for new users
      setStep('character');
      setShowCharacterSelector(true);
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
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Failed to save quiz results');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo/Brand */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-purple-600 mb-2">House of Spells</h1>
          <p className="text-gray-600">Welcome to the magical marketplace</p>
        </div>

        {/* Character Selector */}
        {step === 'character' && (
          <CharacterSelector
            onSelect={handleCharacterSelected}
            onSkip={() => router.push('/')}
          />
        )}

        {/* Fandom Quiz */}
        {step === 'quiz' && (
          <FandomQuiz
            onComplete={handleQuizComplete}
            onSkip={() => router.push('/')}
          />
        )}

        {/* Login/Register Form */}
        {step === 'login' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-center mb-6">
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
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="••••••••"
                />
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
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <button
                  onClick={() => window.location.href = '/api/auth/google'}
                  className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium">Google</span>
                </button>
                <button
                  onClick={() => window.location.href = '/api/auth/facebook'}
                  className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium">Facebook</span>
                </button>
                <button
                  onClick={() => window.location.href = '/api/auth/apple'}
                  className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium">Apple</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

