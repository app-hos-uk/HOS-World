'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import type {
  PublicInfluencerInfo,
  InfluencerStorefront,
  PublicStorefrontProduct,
} from '@hos-marketplace/api-client';

export default function InfluencerStorefrontPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [influencer, setInfluencer] = useState<PublicInfluencerInfo | null>(null);
  const [storefront, setStorefront] = useState<InfluencerStorefront | null>(null);
  const [featuredProducts, setFeaturedProducts] = useState<PublicStorefrontProduct[]>([]);

  useEffect(() => {
    if (slug) {
      fetchStorefront();
      trackVisit();
    }
  }, [slug]);

  const fetchStorefront = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getInfluencerStorefront(slug);
      setInfluencer(response.data?.influencer ?? null);
      setStorefront(response.data?.storefront ?? null);
      setFeaturedProducts(response.data?.featuredProducts ?? []);
    } catch (err: any) {
      console.error('Error fetching storefront:', err);
      setError('Storefront not found');
    } finally {
      setLoading(false);
    }
  };

  const trackVisit = async () => {
    try {
      // Get or create visitor ID
      let visitorId = localStorage.getItem('visitor_id');
      if (!visitorId) {
        visitorId = 'v_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('visitor_id', visitorId);
      }

      // Track the referral
      const storedInfluencer = await apiClient.getInfluencerStorefront(slug);
      if (storedInfluencer.data?.influencer?.referralCode) {
        await apiClient.trackReferral({
          referralCode: storedInfluencer.data.influencer.referralCode,
          visitorId,
          landingPage: `/i/${slug}`,
        });

        // Store referral info for checkout
        localStorage.setItem('referral_code', storedInfluencer.data.influencer.referralCode);
        localStorage.setItem('referral_expires', String(Date.now() + 30 * 24 * 60 * 60 * 1000)); // 30 days
      }
    } catch (err) {
      console.error('Error tracking visit:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  const getSocialIcon = (platform: string) => {
    const icons: Record<string, React.ReactNode> = {
      instagram: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      ),
      facebook: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      youtube: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      ),
      tiktok: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
        </svg>
      ),
      twitter: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      website: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
    };
    return icons[platform] || icons.website;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading storefront...</p>
        </div>
      </div>
    );
  }

  if (error || !influencer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Storefront Not Found</h1>
          <p className="text-gray-600 mb-4">The influencer storefront you're looking for doesn't exist.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const styles = {
    backgroundColor: storefront?.backgroundColor || '#FFFFFF',
    color: storefront?.textColor || '#1F2937',
    fontFamily: storefront?.fontFamily || 'Inter',
    '--primary-color': storefront?.primaryColor || '#7C3AED',
    '--secondary-color': storefront?.secondaryColor || '#F3E8FF',
  } as React.CSSProperties;

  return (
    <div className="min-h-screen" style={styles}>
      {/* Banner */}
      {storefront?.showBanner !== false && (
        <div 
          className="h-48 md:h-64 w-full bg-cover bg-center"
          style={{
            backgroundColor: storefront?.primaryColor || '#7C3AED',
            backgroundImage: influencer.bannerImage ? `url(${influencer.bannerImage})` : undefined,
          }}
        />
      )}

      {/* Profile Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`${storefront?.showBanner !== false ? '-mt-16' : 'pt-8'} relative z-10`}>
          <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
            {/* Profile Image */}
            <div 
              className="w-32 h-32 rounded-full border-4 overflow-hidden flex-shrink-0"
              style={{ 
                borderColor: storefront?.backgroundColor || '#FFFFFF',
                backgroundColor: storefront?.secondaryColor || '#F3E8FF',
              }}
            >
              {influencer.profileImage ? (
                <img
                  src={influencer.profileImage}
                  alt={influencer.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold" 
                     style={{ color: storefront?.primaryColor || '#7C3AED' }}>
                  {influencer.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{influencer.displayName}</h1>
              <p className="opacity-70">@{influencer.slug}</p>
            </div>

            {/* Social Links */}
            {storefront?.showSocialLinks !== false && influencer.socialLinks && (
              <div className="flex gap-3">
                {Object.entries(influencer.socialLinks).map(([platform, url]) => (
                  url && (
                    <a
                      key={platform}
                      href={url.startsWith('http') ? url : `https://${url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
                      style={{ 
                        backgroundColor: storefront?.primaryColor || '#7C3AED',
                        color: '#FFFFFF',
                      }}
                    >
                      {getSocialIcon(platform)}
                    </a>
                  )
                ))}
              </div>
            )}
          </div>

          {/* Bio */}
          {storefront?.showBio !== false && influencer.bio && (
            <p className="mt-6 max-w-2xl opacity-80">
              {influencer.bio}
            </p>
          )}
        </div>

        {/* Featured Products */}
        {featuredProducts.length > 0 && (
          <div className="mt-12 pb-12">
            <h2 className="text-2xl font-bold mb-6">My Picks</h2>
            <div className={`grid gap-6 ${
              storefront?.layoutType === 'list' 
                ? 'grid-cols-1' 
                : storefront?.layoutType === 'masonry'
                ? 'grid-cols-2 md:grid-cols-3'
                : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
            }`}>
              {featuredProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}?ref=${influencer.referralCode}`}
                  className="group rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
                  style={{ backgroundColor: storefront?.secondaryColor || '#F3E8FF' }}
                >
                  <div className="aspect-square overflow-hidden">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0].url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-200">
                        <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium line-clamp-2">{product.name}</h3>
                    <p className="font-bold mt-1" style={{ color: storefront?.primaryColor || '#7C3AED' }}>
                      {formatCurrency(product.price)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All Products Link */}
        <div className="text-center pb-12">
          <Link
            href={`/?ref=${influencer.referralCode}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-colors"
            style={{ 
              backgroundColor: storefront?.primaryColor || '#7C3AED',
              color: '#FFFFFF',
            }}
          >
            Browse All Products
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
