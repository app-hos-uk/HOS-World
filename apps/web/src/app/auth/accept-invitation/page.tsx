'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

function AcceptInvitationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const token = searchParams.get('token');
  
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    storeName: '',
    country: '',
    whatsappNumber: '',
    preferredCommunicationMethod: 'EMAIL' as 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PHONE',
    gdprConsent: false,
  });
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [invitationData, setInvitationData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link. No token provided.');
      setValidating(false);
      return;
    }
    
    // Validate invitation token and fetch details
    const validateToken = async () => {
      try {
        setValidating(true);
        const response = await apiClient.validateInvitation(token);
        if (response?.data) {
          setInvitationData(response.data);
          setFormData(prev => ({
            ...prev,
            email: response?.data?.email || '',
          }));
        } else {
          setError('Invalid or expired invitation token.');
        }
      } catch (err: any) {
        setError(err.message || 'Invalid or expired invitation token.');
      } finally {
        setValidating(false);
      }
    };
    
    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!formData.storeName) {
      setError('Store name is required');
      return;
    }

    if (!formData.country) {
      setError('Country is required');
      return;
    }

    if (!formData.gdprConsent) {
      setError('You must consent to GDPR terms');
      return;
    }

    if (!token) {
      setError('Invalid invitation token');
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.acceptInvitation({
        token,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        password: formData.password,
        storeName: formData.storeName,
        country: formData.country,
        whatsappNumber: formData.whatsappNumber || undefined,
        preferredCommunicationMethod: formData.preferredCommunicationMethod,
        gdprConsent: formData.gdprConsent,
      });
      
      if (response?.data?.token) {
        // Store auth token
        localStorage.setItem('auth_token', response.data.token);
        if (response.data.refreshToken) {
          localStorage.setItem('refresh_token', response.data.refreshToken);
        }
        toast.success('Account created successfully! Redirecting to dashboard...');
        setTimeout(() => {
          router.push('/seller/dashboard');
        }, 1500);
      } else {
        throw new Error('Failed to create account');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation');
      toast.error(err.message || 'Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <div className="text-gray-500">Validating invitation...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!token || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Invitation</h1>
          <p className="text-gray-600">{error || 'This invitation link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Accept Seller Invitation
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Create your account to get started
          </p>
          {invitationData && (
            <p className="mt-1 text-center text-xs text-gray-500">
              Invited as: {invitationData.sellerType === 'WHOLESALER' ? 'Wholesaler' : 'B2C Seller'}
            </p>
          )}
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                disabled
                value={formData.email}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 bg-gray-50 text-gray-500 rounded-lg sm:text-sm"
                placeholder="Email"
              />
              <p className="mt-1 text-xs text-gray-500">Email is pre-filled from invitation</p>
            </div>

            <div>
              <label htmlFor="storeName" className="block text-sm font-medium text-gray-700">
                Store Name *
              </label>
              <input
                id="storeName"
                name="storeName"
                type="text"
                required
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                placeholder="Your store name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name *
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                  placeholder="First name"
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name *
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                  placeholder="Last name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                Country *
              </label>
              <input
                id="country"
                name="country"
                type="text"
                required
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                placeholder="Country"
              />
            </div>

            <div>
              <label htmlFor="whatsappNumber" className="block text-sm font-medium text-gray-700">
                WhatsApp Number (Optional)
              </label>
              <input
                id="whatsappNumber"
                name="whatsappNumber"
                type="tel"
                value={formData.whatsappNumber}
                onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                placeholder="+44 123 456 7890"
              />
            </div>

            <div>
              <label htmlFor="preferredCommunicationMethod" className="block text-sm font-medium text-gray-700">
                Preferred Communication Method *
              </label>
              <select
                id="preferredCommunicationMethod"
                name="preferredCommunicationMethod"
                required
                value={formData.preferredCommunicationMethod}
                onChange={(e) => setFormData({ ...formData, preferredCommunicationMethod: e.target.value as any })}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
              >
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="PHONE">Phone</option>
              </select>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                placeholder="Password (min 8 characters)"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password *
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                placeholder="Confirm password"
              />
            </div>

            <div className="flex items-center">
              <input
                id="gdprConsent"
                name="gdprConsent"
                type="checkbox"
                required
                checked={formData.gdprConsent}
                onChange={(e) => setFormData({ ...formData, gdprConsent: e.target.checked })}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <label htmlFor="gdprConsent" className="ml-2 block text-sm text-gray-900">
                I consent to GDPR terms and data processing *
              </label>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <AcceptInvitationForm />
    </Suspense>
  );
}

