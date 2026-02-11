'use client';

import Image from 'next/image';
import { useState } from 'react';

/**
 * SafeImage — a drop-in replacement for next/image that gracefully handles
 * external URLs which fail Next.js Image Optimization (403, 400, etc.).
 *
 * How it works:
 *  1. First renders a Next.js <Image> for the optimization benefits.
 *  2. If the optimized image fails to load (onError), falls back to a plain
 *     <img> tag which loads directly from the source (no server-side fetch).
 *  3. If the plain <img> also fails, shows a placeholder icon.
 *
 * Usage: identical to next/image — just swap the import.
 *   import { SafeImage } from '@/components/SafeImage';
 *   <SafeImage src={url} alt="..." width={40} height={40} className="rounded" />
 */
interface SafeImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  /** Use Next.js fill mode (parent must be position: relative) */
  fill?: boolean;
  sizes?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Fallback text/emoji shown when both optimized and raw image fail */
  fallback?: string;
}

export function SafeImage({
  src,
  alt,
  width,
  height,
  fill,
  sizes,
  className = '',
  style,
  fallback = '📷',
}: SafeImageProps) {
  const [mode, setMode] = useState<'optimized' | 'raw' | 'failed'>('optimized');

  const placeholderStyle: React.CSSProperties = fill
    ? { position: 'absolute', inset: 0, ...style }
    : { width, height, ...style };

  if (!src || mode === 'failed') {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}
        style={placeholderStyle}
      >
        {fallback}
      </div>
    );
  }

  if (mode === 'raw') {
    /* eslint-disable @next/next/no-img-element */
    return (
      <img
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        className={className}
        style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...style } : style}
        onError={() => setMode('failed')}
        loading="lazy"
      />
    );
  }

  // mode === 'optimized'
  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        style={style}
        onError={() => setMode('raw')}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width!}
      height={height!}
      className={className}
      style={style}
      onError={() => setMode('raw')}
    />
  );
}
