# Image Setup Guide

## Quick Start

1. **Placeholder images (SVG) have been generated** in:
   - `/public/hero/` - Hero banners
   - `/public/banners/` - Carousel banners  
   - `/public/featured/` - Feature banners

2. **For development:** The SVG placeholders will work, but you'll see colored rectangles with text.

3. **For production:** Replace SVG files with actual JPG/WebP images matching the specifications below.

## Image Requirements Summary

### Hero Banners (`/public/hero/`)
| File | Size | Format | Max Size | Aspect Ratio |
|------|------|--------|----------|--------------|
| harry-potter-banner.jpg | 1920x1080px | JPG/WebP | 500KB | 16:9 |
| lotr-banner.jpg | 1920x1080px | JPG/WebP | 500KB | 16:9 |
| got-banner.jpg | 1920x1080px | JPG/WebP | 500KB | 16:9 |

### Banner Carousel (`/public/banners/`)
| File | Size | Format | Max Size | Aspect Ratio |
|------|------|--------|----------|--------------|
| new-arrivals.jpg | 800x600px | JPG/WebP | 200KB | 4:3 |
| best-sellers.jpg | 800x600px | JPG/WebP | 200KB | 4:3 |
| limited-edition.jpg | 800x600px | JPG/WebP | 200KB | 4:3 |
| sale.jpg | 800x600px | JPG/WebP | 200KB | 4:3 |

### Feature Banners (`/public/featured/`)
| File | Size | Format | Max Size | Aspect Ratio |
|------|------|--------|----------|--------------|
| collectibles.jpg | 1920x1080px | JPG/WebP | 400KB | 16:9 |
| apparel.jpg | 1920x1080px | JPG/WebP | 400KB | 16:9 |

## Converting SVG to JPG

### Option 1: Using Online Tools
1. Go to https://cloudconvert.com/svg-to-jpg
2. Upload each SVG file
3. Set quality to 90%
4. Download and rename to match the required filename (e.g., `harry-potter-banner.jpg`)

### Option 2: Using ImageMagick (Command Line)
```bash
# Install ImageMagick first
brew install imagemagick  # macOS
# or
sudo apt-get install imagemagick  # Linux

# Convert all SVG files in hero directory
cd public/hero
for file in *.svg; do 
  convert "$file" "${file%.svg}.jpg"
done

# Repeat for banners and featured directories
cd ../banners
for file in *.svg; do 
  convert "$file" "${file%.svg}.jpg"
done

cd ../featured
for file in *.svg; do 
  convert "$file" "${file%.svg}.jpg"
done
```

### Option 3: Using Node.js with Sharp
```bash
# Install sharp
npm install sharp

# Then use a script to convert (create convert-svg-to-jpg.js)
```

## Using Placeholder Services (Temporary)

If you need temporary images while creating actual ones, you can use placeholder services:

```typescript
// Example placeholder URLs
const heroPlaceholder = 'https://placehold.co/1920x1080/4c1d95/ffffff?text=Harry+Potter+Hero';
const bannerPlaceholder = 'https://placehold.co/800x600/7c3aed/ffffff?text=New+Arrivals';
```

See `src/utils/imagePlaceholders.ts` for helper functions.

## Image Optimization Tips

1. **Use WebP format** for better compression (provide JPG fallback)
2. **Compress before uploading:**
   - TinyPNG: https://tinypng.com
   - Squoosh: https://squoosh.app
   - ImageOptim (Mac app)

3. **Optimize for web:**
   - Remove EXIF data
   - Use sRGB color profile
   - Progressive JPG encoding

4. **Responsive images:**
   - Use Next.js Image component for automatic optimization
   - Consider srcset for different screen sizes

## Color Palette for Image Overlays

When creating images, use these brand colors:
- **Primary Purple:** `#4c1d95`
- **Secondary Purple:** `#7c3aed`
- **Indigo:** `#6366f1`
- **Amber/Gold:** `#d97706` / `#fbbf24`

## Next Steps

1. ✅ Placeholder SVG files created
2. ⏳ Convert SVG to JPG/WebP (or replace with actual images)
3. ⏳ Optimize images for web
4. ⏳ Test images load correctly
5. ⏳ Verify image sizes match specifications

## Detailed Specifications

For complete image specifications, see:
- `/public/IMAGE_SPECIFICATIONS.md` - Full documentation
- Component files - Inline comments with requirements

