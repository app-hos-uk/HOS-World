'use client';

import { useState, useRef, useEffect } from 'react';

type Props = {
  url: string;
  title: string;
};

const SHARE_TARGETS = [
  { key: 'x', label: 'X', buildUrl: (u: string, t: string) => `https://x.com/intent/tweet?text=${enc(t)}&url=${enc(u)}` },
  { key: 'facebook', label: 'Facebook', buildUrl: (u: string) => `https://www.facebook.com/sharer/sharer.php?u=${enc(u)}` },
  { key: 'whatsapp', label: 'WhatsApp', buildUrl: (u: string, t: string) => `https://wa.me/?text=${enc(`${t} ${u}`)}` },
  { key: 'reddit', label: 'Reddit', buildUrl: (u: string, t: string) => `https://reddit.com/submit?url=${enc(u)}&title=${enc(t)}` },
] as const;

function enc(v: string) { return encodeURIComponent(v); }

export function FandomShareButton({ url, title }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch { /* user cancelled or unsupported -- fall through to dropdown */ }
    }
    setOpen((prev) => !prev);
  }

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => { setCopied(false); setOpen(false); }, 1200);
    });
  }

  function handleTarget(e: React.MouseEvent, buildUrl: (u: string, t: string) => string) {
    e.preventDefault();
    e.stopPropagation();
    window.open(buildUrl(url, title), '_blank', 'noopener,noreferrer,width=600,height=500');
    setOpen(false);
  }

  return (
    <div className="fw-share" ref={ref}>
      <button
        type="button"
        className="fw-share-btn"
        onClick={handleShare}
        aria-label="Share"
        title="Share"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      </button>
      {open && (
        <div className="fw-share-dropdown">
          {SHARE_TARGETS.map((t) => (
            <button key={t.key} type="button" className="fw-share-option" onClick={(e) => handleTarget(e, t.buildUrl)}>
              {t.label}
            </button>
          ))}
          <button type="button" className="fw-share-option" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      )}
    </div>
  );
}
