'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-hos-bg to-hos-bg-secondary flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-hos-bg-secondary rounded-xl shadow-lg p-8 text-center">
          <h1 className="text-xl font-bold text-red-400 mb-2">Invalid Reset Link</h1>
          <p className="text-hos-text-secondary mb-6">This password reset link is invalid or has expired.</p>
          <Link href="/login" className="text-hos-gold hover:text-hos-gold-hover font-medium">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    try {
      setLoading(true);
      await apiClient.resetPassword(token, password);
      setSuccess(true);
      toast.success('Password reset successfully');
      setTimeout(() => router.replace('/login'), 3000);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-hos-bg to-hos-bg-secondary flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-hos-bg-secondary rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">Password Reset</h1>
          <p className="text-hos-text-secondary mb-4">Your password has been reset. Redirecting to login...</p>
          <Link href="/login" className="text-hos-gold hover:text-hos-gold-hover font-medium">Go to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-hos-bg to-hos-bg-secondary flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-hos-bg-secondary rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-2 text-center">Reset Password</h1>
        <p className="text-hos-text-secondary mb-6 text-center text-sm">Enter your new password below.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-hos-text-secondary mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-hos-text-secondary mb-1">Confirm Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
              placeholder="Confirm new password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-hos-gold text-[#1a1406] rounded-lg font-semibold hover:bg-hos-gold-hover disabled:opacity-50 transition-colors"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
        <p className="text-center mt-4">
          <Link href="/login" className="text-sm text-hos-gold hover:text-hos-gold-hover">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
