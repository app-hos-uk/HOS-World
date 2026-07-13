'use client';

import { useState } from 'react';
import { GalleryLightbox } from './GalleryLightbox';
import type { GalleryImage } from '../lib/galleryApi';

type Props = {
  images: GalleryImage[];
  albumTitle: string;
};

export function GalleryImageGrid({ images, albumTitle }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <p className="gallery-empty rv">Photos from this event will appear here soon.</p>
    );
  }

  return (
    <>
      <div className="gallery-image-grid">
        {images.map((img, idx) => (
          <button
            key={img.id}
            type="button"
            className="gallery-image-tile rv"
            style={{ transitionDelay: `${Math.min(idx * 0.04, 0.4)}s` }}
            onClick={() => setLightboxIndex(idx)}
            aria-label={`View photo ${idx + 1} from ${albumTitle}`}
          >
            <img src={img.url} alt={img.alt || img.caption || `${albumTitle} photo ${idx + 1}`} loading="lazy" />
            {img.caption && <span className="gallery-image-caption">{img.caption}</span>}
          </button>
        ))}
      </div>
      {lightboxIndex !== null && (
        <GalleryLightbox
          images={images}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
