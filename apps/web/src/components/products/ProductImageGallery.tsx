'use client';

import { useState } from 'react';
import { SafeImage } from '@/components/SafeImage';

export interface ProductImage {
  url?: string;
  alt?: string;
}

interface ProductImageGalleryProps {
  images: Array<ProductImage | string>;
  productName: string;
}

function resolveImageUrl(image: ProductImage | string): string {
  if (typeof image === 'string') return image;
  return image?.url || '';
}

export function ProductImageGallery({ images, productName }: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!images || images.length === 0) {
    return (
      <div className="w-full aspect-square bg-hos-bg-tertiary rounded-lg flex items-center justify-center">
        <span className="text-hos-text-muted">No Image</span>
      </div>
    );
  }

  const currentUrl = resolveImageUrl(images[selectedIndex]);

  return (
    <>
      <div>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="relative w-full aspect-square mb-4 bg-hos-bg-secondary rounded-lg overflow-hidden cursor-zoom-in group isolate"
          aria-label="Zoom product image"
        >
          <SafeImage
            src={currentUrl}
            alt={productName}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain rounded-lg transition-transform group-hover:scale-[1.02]"
          />
          <span className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none">
            Click to zoom
          </span>
        </button>

        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((image, index) => {
              const imageUrl = resolveImageUrl(image);
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  aria-label={`View image ${index + 1}`}
                  aria-pressed={isSelected}
                  className={`relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                    isSelected ? 'border-hos-gold' : 'border-transparent hover:border-hos-border'
                  }`}
                >
                  <SafeImage
                    src={imageUrl}
                    alt={`${productName} ${index + 1}`}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Product image zoom"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl z-10"
            aria-label="Close zoom"
          >
            ×
          </button>

          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIndex((i) => (i > 0 ? i - 1 : images.length - 1));
              }}
              className="absolute left-4 text-white/80 hover:text-white text-3xl z-10"
              aria-label="Previous image"
            >
              ‹
            </button>
          )}

          <div
            className="relative w-full max-w-4xl aspect-square"
            onClick={(e) => e.stopPropagation()}
          >
            <SafeImage
              src={currentUrl}
              alt={productName}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>

          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIndex((i) => (i < images.length - 1 ? i + 1 : 0));
              }}
              className="absolute right-4 text-white/80 hover:text-white text-3xl z-10"
              aria-label="Next image"
            >
              ›
            </button>
          )}
        </div>
      )}
    </>
  );
}
