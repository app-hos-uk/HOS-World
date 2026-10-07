'use client';

import { useEffect, useRef } from 'react';
import { youtubeEmbedUrl } from '../lib/fandomWorldApi';

type Props = {
  videoUrl: string;
  title: string;
  sourceName?: string;
  onClose: () => void;
};

export function FandomVideoModal({ videoUrl, title, sourceName, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const embedUrl = youtubeEmbedUrl(videoUrl);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fw-video-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        className="fw-video-modal-close"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="Close"
      >
        ✕
      </button>
      <div className="fw-video-modal" onClick={(event) => event.stopPropagation()}>
        <div className="fw-video-modal-embed">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={title}
              allow="autoplay; encrypted-media; picture-in-picture"
              loading="lazy"
              allowFullScreen
            />
          ) : null}
        </div>
        <div className="fw-video-modal-info">
          <h3 className="fw-video-modal-title">{title}</h3>
          <p className="fw-video-modal-attribution">
            <a href={videoUrl} target="_blank" rel="noopener noreferrer">
              Watch on YouTube
            </a>
            {sourceName ? <span> · {sourceName}</span> : null}
          </p>
        </div>
      </div>
    </div>
  );
}
