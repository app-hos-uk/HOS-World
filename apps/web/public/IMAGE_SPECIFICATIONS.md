# Image Specifications for House of Spells Marketplace

This document outlines all image requirements, sizes, and formats for the application.

## Hero Banner Images

**Location:** `/public/hero/`

### Requirements:
- **Format:** JPG or WebP (recommended for better compression)
- **Aspect Ratio:** 16:9 (1920x1080px recommended)
- **Minimum Size:** 1920x1080px
- **Maximum File Size:** 500KB (optimized)
- **Color Profile:** sRGB
- **Quality:** High quality, optimized for web

### Files Required:
1. **harry-potter-banner.jpg**
   - Size: 1920x1080px
   - Subject: Harry Potter themed imagery (wands, Hogwarts, magical items)
   - Style: Dark, mystical, with purple/amber accents

2. **lotr-banner.jpg**
   - Size: 1920x1080px
   - Subject: Lord of the Rings themed imagery (Middle-earth landscapes, rings, swords)
   - Style: Epic fantasy, dramatic lighting

3. **got-banner.jpg**
   - Size: 1920x1080px
   - Subject: Game of Thrones themed imagery (Iron Throne, dragons, sigils)
   - Style: Medieval fantasy, rich colors

## Banner Carousel Images

**Location:** `/public/banners/`

### Requirements:
- **Format:** JPG or WebP
- **Aspect Ratio:** 4:3 (800x600px recommended)
- **Minimum Size:** 800x600px
- **Maximum File Size:** 200KB (optimized)
- **Color Profile:** sRGB

### Files Required:
1. **new-arrivals.jpg**
   - Size: 800x600px
   - Subject: New product showcase
   - Style: Bright, fresh, attention-grabbing

2. **best-sellers.jpg**
   - Size: 800x600px
   - Subject: Popular products
   - Style: Dynamic, energetic

3. **limited-edition.jpg**
   - Size: 800x600px
   - Subject: Exclusive/limited items
   - Style: Premium, exclusive feel

4. **sale.jpg**
   - Size: 800x600px
   - Subject: Sale/discount items
   - Style: Bold, promotional

## Feature Banner Images

**Location:** `/public/featured/`

### Requirements:
- **Format:** JPG or WebP
- **Aspect Ratio:** 16:9 (1920x1080px recommended)
- **Minimum Size:** 1920x1080px
- **Maximum File Size:** 400KB (optimized)
- **Color Profile:** sRGB

### Files Required:
1. **collectibles.jpg**
   - Size: 1920x1080px
   - Subject: Collectible items display
   - Style: Premium, detailed product shots

2. **apparel.jpg**
   - Size: 1920x1080px
   - Subject: Clothing and apparel
   - Style: Fashion-forward, lifestyle imagery

## Product Images

**Location:** `/public/products/` (when implemented)

### Requirements:
- **Format:** WebP (primary), JPG (fallback)
- **Aspect Ratio:** 1:1 (square) for thumbnails, 4:3 for detail views
- **Thumbnail Size:** 400x400px
- **Detail Size:** 1200x900px
- **Maximum File Size:** 
  - Thumbnails: 50KB
  - Detail: 200KB
- **Color Profile:** sRGB
- **Background:** White or transparent (for product images)

## Fandom Collection Images

**Location:** `/public/fandoms/` (when implemented)

### Requirements:
- **Format:** WebP or JPG
- **Aspect Ratio:** 16:9
- **Size:** 800x450px
- **Maximum File Size:** 150KB
- **Style:** Representative of each fandom

## General Image Guidelines

### Optimization:
- Use WebP format when possible for better compression
- Always provide JPG fallback for older browsers
- Compress images before uploading (use tools like TinyPNG, ImageOptim)
- Use responsive images with `srcset` for different screen sizes

### Accessibility:
- Always include descriptive `alt` text
- Ensure sufficient color contrast
- Don't use text in images (use CSS for text overlay)

### Performance:
- Lazy load images below the fold
- Use Next.js Image component for automatic optimization
- Consider using CDN for image delivery in production

## Image Generation Tools

### Recommended Tools:
1. **Placeholder Services:**
   - `https://via.placeholder.com/1920x1080/4c1d95/ffffff?text=Harry+Potter`
   - `https://placehold.co/1920x1080/4c1d95/ffffff?text=Hero+Banner`

2. **Image Optimization:**
   - TinyPNG (https://tinypng.com)
   - ImageOptim (Mac app)
   - Squoosh (https://squoosh.app)

3. **Image Editing:**
   - Photoshop
   - GIMP (free)
   - Canva (for quick designs)

## Color Palette for Image Overlays

When creating images, consider these brand colors:
- **Primary Purple:** `#4c1d95`
- **Secondary Purple:** `#7c3aed`
- **Indigo:** `#6366f1`
- **Amber/Gold:** `#d97706` / `#fbbf24`
- **Background:** `#ffffff`

## Next.js Image Component Usage

```tsx
import Image from 'next/image';

<Image
  src="/hero/harry-potter-banner.jpg"
  alt="Harry Potter Collection"
  width={1920}
  height={1080}
  priority // For above-the-fold images
  quality={90}
  className="object-cover"
/>
```

## Responsive Image Sizes

For responsive images, use these breakpoints:
- **Mobile:** 640px width
- **Tablet:** 1024px width
- **Desktop:** 1920px width
- **Large Desktop:** 2560px width

