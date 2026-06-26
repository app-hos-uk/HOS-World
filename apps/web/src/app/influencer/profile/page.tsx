'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { validateInfluencerProfileUrls } from '@/lib/httpUrlValidation';

const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/username' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/username' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@channel' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@username' },
  { key: 'twitter', label: 'Twitter / X', placeholder: 'https://x.com/username' },
  { key: 'website', label: 'Website', placeholder: 'https://yoursite.com' },
] as const;

const SOCIAL_LABEL_BY_KEY: Record<string, string> = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p.key, p.label]),
);

interface Profile {
  id: string;
  displayName: string;
  slug: string;
  bio?: string;
  profileImage?: string;
  bannerImage?: string;
  socialLinks?: Record<string, string>;
}

export default function InfluencerProfilePage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [bannerImage, setBannerImage] = useState('');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getMyInfluencerProfile();
      const data = res.data as Profile | undefined;
      if (data) {
        setProfile(data);
        setDisplayName(data.displayName ?? '');
        setBio(data.bio ?? '');
        setProfileImage(data.profileImage ?? '');
        setBannerImage(data.bannerImage ?? '');
        setSocialLinks(data.socialLinks ?? {});
      }
    } catch {
      console.error('Failed to load influencer profile');
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLinkChange = (key: string, value: string) => {
    setSocialLinks((prev) => {
      const next = { ...prev };
      if (value.trim()) {
        next[key] = value.trim();
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const handleSave = async () => {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      const msg = 'Display name is required';
      setDisplayNameError(msg);
      toast.error(msg);
      return;
    }
    setDisplayNameError(null);

    const urlErr = validateInfluencerProfileUrls({
      profileImage,
      bannerImage,
      socialLinks,
      socialLabels: SOCIAL_LABEL_BY_KEY,
    });
    if (urlErr) {
      toast.error(urlErr);
      return;
    }
    try {
      setSaving(true);
      await apiClient.updateMyInfluencerProfile({
        displayName: trimmedName,
        bio: bio.trim() || undefined,
        profileImage: profileImage.trim() || undefined,
        bannerImage: bannerImage.trim() || undefined,
        socialLinks: Object.keys(socialLinks).length ? socialLinks : undefined,
      });
      toast.success('Profile saved successfully');
      fetchProfile();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold mx-auto" />
          <p className="mt-4 text-hos-text-secondary">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/influencer/dashboard"
          className="inline-flex items-center gap-2 text-hos-gold hover:text-hos-gold-hover font-medium mb-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m7 7h18" />
          </svg>
          Back to Dashboard
        </Link>

        <h1 className="text-3xl font-bold text-hos-text-secondary mb-2">Profile & Social Links</h1>
        <p className="text-hos-text-secondary mb-8">
          Update your display info and social links. They appear on your public storefront when enabled.
        </p>

        <div className="space-y-8">
          {/* Basic profile */}
          <div className="bg-hos-bg-secondary rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Public profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Display name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    if (displayNameError) setDisplayNameError(null);
                  }}
                  className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold"
                  placeholder="Your name"
                />
                {displayNameError && (
                  <p className="mt-1 text-sm text-red-400">{displayNameError}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold"
                  placeholder="A short bio for your storefront"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Profile image URL</label>
                <input
                  type="url"
                  value={profileImage}
                  onChange={(e) => setProfileImage(e.target.value)}
                  className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Banner image URL</label>
                <input
                  type="url"
                  value={bannerImage}
                  onChange={(e) => setBannerImage(e.target.value)}
                  className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          {/* Social links */}
          <div className="bg-hos-bg-secondary rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-hos-text-secondary mb-2">Social media links</h2>
            <p className="text-sm text-hos-text-muted mb-4">
              Add full URLs. They will show on your storefront when &quot;Show social media links&quot; is on in Storefront settings.
            </p>
            <div className="space-y-4">
              {SOCIAL_PLATFORMS.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">{label}</label>
                  <input
                    type="url"
                    value={socialLinks[key] ?? ''}
                    onChange={(e) => handleSocialLinkChange(key, e.target.value)}
                    className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold"
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-hos-gold text-[#1a1406] rounded-lg font-medium hover:bg-hos-gold-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save profile'}
            </button>
            {profile?.slug && (
              <Link
                href={`/i/${profile.slug}`}
                target="_blank"
                className="inline-flex items-center gap-2 text-hos-gold hover:text-hos-gold-hover font-medium"
              >
                View storefront
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="mt-12 pt-8 border-t border-hos-border">
          <p className="text-sm font-medium text-hos-text-secondary mb-3">Quick links</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/influencer/dashboard" className="text-hos-gold hover:text-hos-gold-hover text-sm font-medium">
              Dashboard
            </Link>
            <Link href="/influencer/storefront" className="text-hos-gold hover:text-hos-gold-hover text-sm font-medium">
              Storefront settings
            </Link>
            <Link href="/influencer/product-links" className="text-hos-gold hover:text-hos-gold-hover text-sm font-medium">
              Product links
            </Link>
            <Link href="/influencer/earnings" className="text-hos-gold hover:text-hos-gold-hover text-sm font-medium">
              Earnings
            </Link>
          </div>
        </div>
    </div>
  );
}
