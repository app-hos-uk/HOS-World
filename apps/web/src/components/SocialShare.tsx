'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getPublicApiBaseUrl } from '@/lib/apiBaseUrl';

interface SocialShareProps {
  type: 'PRODUCT' | 'COLLECTION' | 'WISHLIST' | 'ACHIEVEMENT' | 'QUEST';
  itemId: string;
  itemName?: string;
  itemImage?: string;
}

export function SocialShare({ type, itemId, itemName, itemImage: _itemImage }: SocialShareProps) {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [portalPosition, setPortalPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updateMenuPosition = useCallback(() => {
    const el = btnRef.current;
    if (!el || typeof window === 'undefined') return;
    const r = el.getBoundingClientRect();
    const mw = 192; // matches w-48
    let left = r.left;
    left = Math.min(left, window.innerWidth - mw - 12);
    left = Math.max(8, left);
    const top = r.bottom + 8;
    setPortalPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!showShareMenu) return;
    updateMenuPosition();
    const onScrollOrResize = () => updateMenuPosition();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowShareMenu(false);
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showShareMenu, updateMenuPosition]);

  const handleShare = async (platform?: string) => {
    try {
      const apiUrl = getPublicApiBaseUrl() || 'http://localhost:3001/api';
      const urlResponse = await fetch(`${apiUrl}/social-sharing/share-url?type=${type}&itemId=${itemId}`, {
        credentials: 'include',
      });
      const urlData = await urlResponse.json();
      const shareUrl = urlData.data.url;

      const shareText = `Check out ${itemName || 'this'} on House of Spells Marketplace!`;

      if (platform === 'copy') {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);

        const recordUrl = getPublicApiBaseUrl() || 'http://localhost:3001/api';
        await fetch(`${recordUrl}/social-sharing/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ type, itemId, platform: 'copy_link' }),
        });
      } else if (platform === 'facebook') {
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
          '_blank',
        );

        await fetch(`${apiUrl}/social-sharing/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ type, itemId, platform: 'facebook' }),
        });
      } else if (platform === 'twitter') {
        window.open(
          `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
          '_blank',
        );

        await fetch(`${apiUrl}/social-sharing/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ type, itemId, platform: 'twitter' }),
        });
      } else if (platform === 'whatsapp') {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`, '_blank');

        await fetch(`${apiUrl}/social-sharing/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ type, itemId, platform: 'whatsapp' }),
        });
      }

      setShowShareMenu(false);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const menuMarkup =
    showShareMenu && typeof document !== 'undefined' ? (
      <>
        <div
          className="fixed inset-0 z-[80]"
          aria-hidden="true"
          onClick={() => setShowShareMenu(false)}
        />
        <div
          role="menu"
          className="fixed w-48 bg-hos-bg-secondary rounded-lg shadow-lg border border-hos-border z-[90] p-2"
          style={{ top: portalPosition.top, left: portalPosition.left }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleShare('copy')}
            className="w-full text-left px-4 py-2 hover:bg-hos-bg-tertiary rounded-lg flex items-center gap-2"
          >
            {copied ? '✓ Link Copied!' : '📋 Copy Link'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleShare('facebook')}
            className="w-full text-left px-4 py-2 hover:bg-hos-bg-tertiary rounded-lg flex items-center gap-2"
          >
            <span>📘</span> Facebook
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleShare('twitter')}
            className="w-full text-left px-4 py-2 hover:bg-hos-bg-tertiary rounded-lg flex items-center gap-2"
          >
            <span>🐦</span> Twitter
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleShare('whatsapp')}
            className="w-full text-left px-4 py-2 hover:bg-hos-bg-tertiary rounded-lg flex items-center gap-2"
          >
            <span>💬</span> WhatsApp
          </button>
        </div>
      </>
    ) : null;

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          if (!showShareMenu) updateMenuPosition();
          setShowShareMenu((v) => !v);
        }}
        aria-expanded={showShareMenu}
        aria-haspopup="menu"
        className="flex items-center gap-2 px-4 py-2 bg-hos-bg-tertiary hover:bg-hos-bg-tertiary rounded-lg transition-colors"
      >
        <span>📤</span>
        <span>Share</span>
      </button>

      {typeof document !== 'undefined' && menuMarkup ? createPortal(menuMarkup, document.body) : null}
    </div>
  );
}
