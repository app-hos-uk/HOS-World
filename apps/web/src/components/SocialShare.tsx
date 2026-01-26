'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { getPublicApiBaseUrl } from '@/lib/apiBaseUrl';

interface SocialShareProps {
  type: 'PRODUCT' | 'COLLECTION' | 'WISHLIST' | 'ACHIEVEMENT' | 'QUEST';
  itemId: string;
  itemName?: string;
  itemImage?: string;
}

export function SocialShare({ type, itemId, itemName, itemImage }: SocialShareProps) {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = async (platform?: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      // Generate share URL
      const apiUrl = getPublicApiBaseUrl() || 'http://localhost:3001/api';
      const urlResponse = await fetch(`${apiUrl}/social-sharing/share-url?type=${type}&itemId=${itemId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const urlData = await urlResponse.json();
      const shareUrl = urlData.data.url;

      // Share to platform
      const shareText = `Check out ${itemName || 'this'} on House of Spells Marketplace!`;

      if (platform === 'copy') {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        
        // Record share
        const apiUrl = getPublicApiBaseUrl() || 'http://localhost:3001/api';
        await fetch(`${apiUrl}/social-sharing/share`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type,
            itemId,
            platform: 'copy_link',
          }),
        });
      } else if (platform === 'facebook') {
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
          '_blank'
        );
        
        await fetch('/api/social-sharing/share', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type,
            itemId,
            platform: 'facebook',
          }),
        });
      } else if (platform === 'twitter') {
        window.open(
          `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
          '_blank'
        );
        
        await fetch('/api/social-sharing/share', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type,
            itemId,
            platform: 'twitter',
          }),
        });
      } else if (platform === 'whatsapp') {
        window.open(
          `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
          '_blank'
        );
        
        await fetch('/api/social-sharing/share', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type,
            itemId,
            platform: 'whatsapp',
          }),
        });
      }

      setShowShareMenu(false);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowShareMenu(!showShareMenu)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        <span>📤</span>
        <span>Share</span>
      </button>

      {showShareMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowShareMenu(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 p-2">
            <button
              onClick={() => handleShare('copy')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-lg flex items-center gap-2"
            >
              {copied ? '✓ Link Copied!' : '📋 Copy Link'}
            </button>
            <button
              onClick={() => handleShare('facebook')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-lg flex items-center gap-2"
            >
              <span>📘</span> Facebook
            </button>
            <button
              onClick={() => handleShare('twitter')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-lg flex items-center gap-2"
            >
              <span>🐦</span> Twitter
            </button>
            <button
              onClick={() => handleShare('whatsapp')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-lg flex items-center gap-2"
            >
              <span>💬</span> WhatsApp
            </button>
          </div>
        </>
      )}
    </div>
  );
}

