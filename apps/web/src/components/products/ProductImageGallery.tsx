'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export function ProductImageGallery({ images, productName }: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const openLightbox = useCallback(() => {
    resetZoom();
    setLightboxOpen(true);
  }, [resetZoom]);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    resetZoom();
  }, [resetZoom]);

  const goToImage = useCallback((dir: 1 | -1) => {
    setSelectedIndex((i) => {
      const next = i + dir;
      if (next < 0) return images.length - 1;
      if (next >= images.length) return 0;
      return next;
    });
    resetZoom();
  }, [images.length, resetZoom]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') goToImage(-1);
      if (e.key === 'ArrowRight') goToImage(1);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [lightboxOpen, closeLightbox, goToImage]);

  // Block all wheel/scroll/pinch events on the lightbox overlay so nothing
  // leaks to the background page.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !lightboxOpen) return;
    const blockWheel = (e: WheelEvent) => { e.preventDefault(); e.stopPropagation(); };
    overlay.addEventListener('wheel', blockWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', blockWheel);
  }, [lightboxOpen]);

  // Non-passive wheel handler on the image container to drive zoom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !lightboxOpen) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setScale((s) => clamp(s + (e.deltaY < 0 ? 0.25 : -0.25), 1, 5));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [lightboxOpen]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (scale <= 1) return;
    dragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [scale]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setTranslate((t) => ({ x: t.x + dx, y: t.y + dy }));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(2.5);
    }
  }, [scale, resetZoom]);

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
          onClick={openLightbox}
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
          ref={overlayRef}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 touch-none"
          role="dialog"
          aria-modal="true"
          aria-label="Product image zoom"
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl z-10"
            aria-label="Close zoom"
          >
            ×
          </button>

          {scale > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); resetZoom(); }}
              className="absolute top-4 left-4 text-white/70 hover:text-white text-sm bg-white/10 px-3 py-1.5 rounded-lg z-10"
            >
              Reset zoom
            </button>
          )}

          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goToImage(-1); }}
              className="absolute left-4 text-white/80 hover:text-white text-3xl z-10"
              aria-label="Previous image"
            >
              ‹
            </button>
          )}

          <div
            ref={containerRef}
            className="relative w-full max-w-4xl aspect-square overflow-hidden touch-none select-none"
            style={{ cursor: scale > 1 ? 'grab' : 'zoom-in' }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDoubleClick={handleDoubleClick}
          >
            <SafeImage
              src={currentUrl}
              alt={productName}
              fill
              sizes="100vw"
              className="object-contain pointer-events-none"
              style={{
                transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
                transition: dragging.current ? 'none' : 'transform 0.2s ease-out',
              }}
            />
          </div>

          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goToImage(1); }}
              className="absolute right-4 text-white/80 hover:text-white text-3xl z-10"
              aria-label="Next image"
            >
              ›
            </button>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs z-10">
            Scroll to zoom · Double-click to toggle · Drag to pan
          </div>
        </div>
      )}
    </>
  );
}
