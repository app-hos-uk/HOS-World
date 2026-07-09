'use client';

export type ImageContext =
  | 'product'
  | 'product-seller'
  | 'product-variation'
  | 'banner-hero'
  | 'banner-promotional'
  | 'banner-sidebar'
  | 'blog-cover'
  | 'blog-inline'
  | 'catalog'
  | 'marketing'
  | 'media-general';

interface Spec {
  formats: string;
  dimensions: string;
  maxSize: string;
  maxFiles?: number;
  aspect?: string;
  notes?: string;
}

const SPECS: Record<ImageContext, Spec> = {
  product: {
    formats: 'JPEG, PNG, GIF, WebP',
    dimensions: '1200 × 900px (detail) · 400 × 400px (thumbnail)',
    maxSize: '5 MB',
    maxFiles: 4,
    aspect: '1:1 or 4:3',
    notes: 'White or transparent background recommended',
  },
  'product-seller': {
    formats: 'JPEG, PNG, GIF, WebP',
    dimensions: '1200 × 900px (detail) · 400 × 400px (thumbnail)',
    maxSize: '10 MB',
    maxFiles: 4,
    aspect: '1:1 or 4:3',
    notes: 'White or transparent background recommended',
  },
  'product-variation': {
    formats: 'JPEG, PNG, GIF, WebP',
    dimensions: '400 × 400px',
    maxSize: '5 MB',
    aspect: '1:1 (square)',
  },
  'banner-hero': {
    formats: 'JPG, WebP',
    dimensions: '1920 × 1080px',
    maxSize: '500 KB',
    aspect: '16:9',
  },
  'banner-promotional': {
    formats: 'JPG, WebP',
    dimensions: '800 × 600px',
    maxSize: '200 KB',
    aspect: '4:3',
  },
  'banner-sidebar': {
    formats: 'JPG, WebP',
    dimensions: '400 × 600px',
    maxSize: '200 KB',
    aspect: '2:3',
  },
  'blog-cover': {
    formats: 'JPEG, PNG, WebP',
    dimensions: '1200 × 630px',
    maxSize: '10 MB',
    aspect: '1.91:1 (Open Graph)',
  },
  'blog-inline': {
    formats: 'JPEG, PNG, GIF, WebP',
    dimensions: '800px minimum width',
    maxSize: '10 MB',
  },
  catalog: {
    formats: 'JPEG, PNG, GIF, WebP',
    dimensions: '1200 × 900px',
    maxSize: '250 KB',
    maxFiles: 4,
    aspect: '4:3',
  },
  marketing: {
    formats: 'JPEG, PNG, GIF, WebP',
    dimensions: '1920 × 1080px (banners) · 800 × 800px (social)',
    maxSize: '250 KB',
  },
  'media-general': {
    formats: 'JPEG, PNG, GIF, WebP',
    dimensions: 'Varies by usage (see below)',
    maxSize: '10 MB',
    notes: 'Products: 1200×900 · Banners: 1920×1080 · Blog: 1200×630 · Thumbnails: 400×400',
  },
};

interface ImageSpecsHintProps {
  context: ImageContext;
  className?: string;
  compact?: boolean;
}

export function ImageSpecsHint({ context, className = '', compact = false }: ImageSpecsHintProps) {
  const spec = SPECS[context];
  if (!spec) return null;

  if (compact) {
    return (
      <span className={`text-xs text-hos-text-muted ${className}`}>
        {spec.formats} · {spec.dimensions} · max {spec.maxSize}
        {spec.maxFiles ? ` · up to ${spec.maxFiles}` : ''}
      </span>
    );
  }

  return (
    <div className={`text-xs text-hos-text-muted space-y-0.5 ${className}`}>
      <div className="flex items-start gap-1.5">
        <span className="text-hos-text-muted/60 shrink-0">Format:</span>
        <span>{spec.formats}</span>
      </div>
      <div className="flex items-start gap-1.5">
        <span className="text-hos-text-muted/60 shrink-0">Size:</span>
        <span>{spec.dimensions}</span>
      </div>
      <div className="flex items-start gap-1.5">
        <span className="text-hos-text-muted/60 shrink-0">Max file:</span>
        <span>{spec.maxSize}{spec.maxFiles ? ` · up to ${spec.maxFiles} files` : ''}</span>
      </div>
      {spec.aspect && (
        <div className="flex items-start gap-1.5">
          <span className="text-hos-text-muted/60 shrink-0">Aspect:</span>
          <span>{spec.aspect}</span>
        </div>
      )}
      {spec.notes && (
        <div className="mt-1 text-hos-text-muted/80 italic">{spec.notes}</div>
      )}
    </div>
  );
}

export function getBannerContext(type: string): ImageContext {
  switch (type) {
    case 'hero': return 'banner-hero';
    case 'promotional': return 'banner-promotional';
    case 'sidebar': return 'banner-sidebar';
    default: return 'banner-hero';
  }
}
