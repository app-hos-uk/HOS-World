'use client';

import { useEffect, useState } from 'react';

type Props = {
  images: Array<{ url: string; alt?: string | null; caption?: string | null }>;
  startIndex?: number;
  onClose: () => void;
};

export function GalleryLightbox({ images, startIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    setIndex(startIndex);
  }, [startIndex]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => (i <= 0 ? images.length - 1 : i - 1));
      if (e.key === 'ArrowRight') setIndex((i) => (i >= images.length - 1 ? 0 : i + 1));
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [images.length, onClose]);

  if (images.length === 0) return null;
  const current = images[index];

  return (
    <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label="Image viewer">
      <button type="button" className="gallery-lightbox-close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      {images.length > 1 && (
        <>
          <button
            type="button"
            className="gallery-lightbox-nav gallery-lightbox-prev"
            onClick={() => setIndex((i) => (i <= 0 ? images.length - 1 : i - 1))}
            aria-label="Previous image"
          >
            ‹
          </button>
          <button
            type="button"
            className="gallery-lightbox-nav gallery-lightbox-next"
            onClick={() => setIndex((i) => (i >= images.length - 1 ? 0 : i + 1))}
            aria-label="Next image"
          >
            ›
          </button>
        </>
      )}
      <div className="gallery-lightbox-stage">
        <img src={current.url} alt={current.alt || current.caption || ''} />
        {(current.caption || images.length > 1) && (
          <div className="gallery-lightbox-caption">
            {current.caption && <p>{current.caption}</p>}
            {images.length > 1 && (
              <span>
                {index + 1} / {images.length}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
