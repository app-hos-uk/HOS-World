'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient, markLoginSuccess, mergeGuestCartAfterAuth } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type InvitationType = 'seller' | 'influencer';

function AcceptInvitationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const token = searchParams.get('token');
  const typeParam = searchParams.get('type');
  const invitationType: InvitationType = typeParam === 'influencer' ? 'influencer' : 'seller';

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    storeName: '',
    displayName: '',
    country: '',
    whatsappNumber: '',
    preferredCommunicationMethod: 'EMAIL' as 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PHONE',
    gdprConsent: false,
  });
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [invitationData, setInvitationData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isValidationError, setIsValidationError] = useState(false);
  const [detectedType, setDetectedType] = useState<InvitationType>(invitationType);

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link. No token provided.');
      setIsValidationError(true);
      setValidating(false);
      return;
    }

    const validateToken = async () => {
      try {
        setValidating(true);

        if (invitationType === 'influencer') {
          const response = await apiClient.getInfluencerInvitationByToken(token);
          if (response?.data) {
            setInvitationData(response.data);
            setDetectedType('influencer');
            setFormData(prev => ({
              ...prev,
              email: response.data?.email || '',
            }));
          } else {
            setError('Invalid or expired invitation token.');
            setIsValidationError(true);
          }
        } else {
          // Try seller first
          try {
            const response = await apiClient.validateInvitation(token);
            if (response?.data) {
              setInvitationData(response.data);
              setDetectedType('seller');
              setFormData(prev => ({
                ...prev,
                email: response.data?.email || '',
              }));
            } else {
              throw new Error('not_seller');
            }
          } catch {
            // Seller validation failed — try influencer as fallback
            try {
              const infResponse = await apiClient.getInfluencerInvitationByToken(token);
              if (infResponse?.data) {
                setInvitationData(infResponse.data);
                setDetectedType('influencer');
                setFormData(prev => ({
                  ...prev,
                  email: infResponse.data?.email || '',
                }));
              } else {
                setError('Invalid or expired invitation token.');
                setIsValidationError(true);
              }
            } catch {
              setError('Invalid or expired invitation token.');
              setIsValidationError(true);
            }
          }
        }
      } catch (err: any) {
        setError(err.message || 'Invalid or expired invitation token.');
        setIsValidationError(true);
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token, invitationType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nameRegex = /^[\p{L}\s\-'.]+$/u;
    if (formData.firstName && !nameRegex.test(formData.firstName)) {
      setError('First name must contain only letters, spaces, hyphens, or apostrophes');
      return;
    }
    if (formData.lastName && !nameRegex.test(formData.lastName)) {
      setError('Last name must contain only letters, spaces, hyphens, or apostrophes');
      return;
    }

    const phoneRegex = /^\+?[\d\s\-()]+$/;
    if (formData.whatsappNumber && !phoneRegex.test(formData.whatsappNumber)) {
      setError('WhatsApp number must contain only digits, spaces, hyphens, and an optional leading +');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (detectedType === 'seller' && !formData.storeName) {
      setError('Store name is required');
      return;
    }

    if (detectedType === 'influencer' && !formData.displayName) {
      setError('Display name is required');
      return;
    }

    if (detectedType === 'seller' && !formData.country) {
      setError('Country is required');
      return;
    }

    if (!formData.gdprConsent) {
      setError('You must acknowledge the Privacy Notice to continue');
      return;
    }

    if (!token) {
      setError('Invalid invitation token');
      return;
    }

    try {
      setLoading(true);

      if (detectedType === 'influencer') {
        const infResponse = await apiClient.acceptInfluencerInvitation(token, {
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          displayName: formData.displayName,
        });

        if (infResponse?.data?.token) {
          localStorage.setItem('auth_token', infResponse.data.token);
          if (infResponse.data.refreshToken) {
            localStorage.setItem('refresh_token', infResponse.data.refreshToken);
          }
          await mergeGuestCartAfterAuth();
          markLoginSuccess();
          toast.success('Account created successfully! Redirecting to dashboard...');
          setTimeout(() => {
            router.replace('/influencer/dashboard');
          }, 1500);
        } else {
          toast.success('Account created! Redirecting to login...');
          setTimeout(() => {
            router.replace('/login');
          }, 1500);
        }
      } else {
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
          localStorage.setItem('auth_token', response.data.token);
          if (response.data.refreshToken) {
            localStorage.setItem('refresh_token', response.data.refreshToken);
          }
          await mergeGuestCartAfterAuth();
          markLoginSuccess();
          toast.success('Account created successfully! Redirecting to dashboard...');
          setTimeout(() => {
            router.replace('/seller/dashboard');
          }, 1500);
        } else {
          throw new Error('Failed to create account');
        }
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
      <div className="min-h-screen flex items-center justify-center bg-hos-bg-secondary">
        <div className="max-w-md w-full bg-hos-bg-secondary rounded-lg shadow p-6">
          <div className="text-center">
            <div className="text-hos-text-muted">Validating invitation...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!token || isValidationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hos-bg-secondary">
        <div className="max-w-md w-full bg-hos-bg-secondary rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-white mb-4">Invalid Invitation</h1>
          <p className="text-hos-text-secondary">{error || 'This invitation link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  const isInfluencer = detectedType === 'influencer';
  const headingText = isInfluencer ? 'Accept Influencer Invitation' : 'Accept Seller Invitation';
  const roleLabel = isInfluencer
    ? 'Influencer'
    : invitationData?.sellerType === 'WHOLESALER'
      ? 'Wholesaler'
      : 'B2C Seller';

  return (
    <div className="min-h-screen flex items-center justify-center bg-hos-bg-secondary py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            {headingText}
          </h2>
          <p className="mt-2 text-center text-sm text-hos-text-secondary">
            Create your account to get started
          </p>
          {invitationData && (
            <p className="mt-1 text-center text-xs text-hos-text-muted">
              Invited as: {roleLabel}
            </p>
          )}
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-hos-text-secondary">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                disabled
                value={formData.email}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-hos-border bg-hos-bg-secondary text-hos-text-muted rounded-lg sm:text-sm"
                placeholder="Email"
              />
              <p className="mt-1 text-xs text-hos-text-muted">Email is pre-filled from invitation</p>
            </div>

            {isInfluencer ? (
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-hos-text-secondary">
                  Display Name *
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  required
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-hos-border placeholder-hos-text-muted text-white rounded-lg focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold focus:z-10 sm:text-sm"
                  placeholder="Your public display name"
                />
              </div>
            ) : (
              <div>
                <label htmlFor="storeName" className="block text-sm font-medium text-hos-text-secondary">
                  Store Name *
                </label>
                <input
                  id="storeName"
                  name="storeName"
                  type="text"
                  required
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-hos-border placeholder-hos-text-muted text-white rounded-lg focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold focus:z-10 sm:text-sm"
                  placeholder="Your store name"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-hos-text-secondary">
                  First Name *
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  maxLength={50}
                  value={formData.firstName}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^[A-Za-z\s\-'.]+$/.test(val)) {
                      setFormData({ ...formData, firstName: val });
                    }
                  }}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-hos-border placeholder-hos-text-muted text-white rounded-lg focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold focus:z-10 sm:text-sm"
                  placeholder="First name"
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-hos-text-secondary">
                  Last Name *
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  maxLength={50}
                  value={formData.lastName}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^[A-Za-z\s\-'.]+$/.test(val)) {
                      setFormData({ ...formData, lastName: val });
                    }
                  }}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-hos-border placeholder-hos-text-muted text-white rounded-lg focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold focus:z-10 sm:text-sm"
                  placeholder="Last name"
                />
              </div>
            </div>

            {!isInfluencer && (
              <>
                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-hos-text-secondary">
                    Country *
                  </label>
                  <input
                    id="country"
                    name="country"
                    type="text"
                    required
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-hos-border placeholder-hos-text-muted text-white rounded-lg focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold focus:z-10 sm:text-sm"
                    placeholder="Country"
                  />
                </div>

                <div>
                  <label htmlFor="whatsappNumber" className="block text-sm font-medium text-hos-text-secondary">
                    WhatsApp Number (Optional)
                  </label>
                  <input
                    id="whatsappNumber"
                    name="whatsappNumber"
                    type="tel"
                    value={formData.whatsappNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\+?[\d\s\-()]*$/.test(val)) {
                        setFormData({ ...formData, whatsappNumber: val });
                      }
                    }}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-hos-border placeholder-hos-text-muted text-white rounded-lg focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold focus:z-10 sm:text-sm"
                    placeholder="+1 555 123 4567"
                  />
                </div>

                <div>
                  <label htmlFor="preferredCommunicationMethod" className="block text-sm font-medium text-hos-text-secondary">
                    Preferred Communication Method *
                  </label>
                  <select
                    id="preferredCommunicationMethod"
                    name="preferredCommunicationMethod"
                    required
                    value={formData.preferredCommunicationMethod}
                    onChange={(e) => setFormData({ ...formData, preferredCommunicationMethod: e.target.value as any })}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-hos-border text-white rounded-lg focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold focus:z-10 sm:text-sm"
                  >
                    <option value="EMAIL">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="PHONE">Phone</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-hos-text-secondary">
                Password *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-hos-border placeholder-hos-text-muted text-white rounded-lg focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold focus:z-10 sm:text-sm"
                placeholder="Password (min 8 characters)"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-hos-text-secondary">
                Confirm Password *
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-hos-border placeholder-hos-text-muted text-white rounded-lg focus:outline-none focus:ring-hos-gold/50 focus:border-hos-gold focus:z-10 sm:text-sm"
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
                className="h-4 w-4 text-hos-gold focus:ring-hos-gold/50 border-hos-border rounded"
              />
              <label htmlFor="gdprConsent" className="ml-2 block text-sm text-white">
                I acknowledge the <a href="/privacy-policy" target="_blank" className="text-hos-gold hover:underline">Privacy Policy</a> and consent to data processing *
              </label>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-hos-gold hover:bg-hos-gold-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hos-gold/50 disabled:opacity-50"
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
      <div className="min-h-screen flex items-center justify-center bg-hos-bg-secondary">
        <div className="text-hos-text-muted">Loading...</div>
      </div>
    }>
      <AcceptInvitationForm />
    </Suspense>
  );
}
