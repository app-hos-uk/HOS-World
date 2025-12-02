# Image Setup - Complete ✅

## What Has Been Created

### 1. Placeholder Images (SVG)
All placeholder images have been generated in the following locations:

**Hero Banners** (`/public/hero/`):
- ✅ `harry-potter-banner.svg` → Convert to `harry-potter-banner.jpg` (1920x1080px)
- ✅ `lotr-banner.svg` → Convert to `lotr-banner.jpg` (1920x1080px)
- ✅ `got-banner.svg` → Convert to `got-banner.jpg` (1920x1080px)

**Banner Carousel** (`/public/banners/`):
- ✅ `new-arrivals.svg` → Convert to `new-arrivals.jpg` (800x600px)
- ✅ `best-sellers.svg` → Convert to `best-sellers.jpg` (800x600px)
- ✅ `limited-edition.svg` → Convert to `limited-edition.jpg` (800x600px)
- ✅ `sale.svg` → Convert to `sale.jpg` (800x600px)

**Feature Banners** (`/public/featured/`):
- ✅ `collectibles.svg` → Convert to `collectibles.jpg` (1920x1080px)
- ✅ `apparel.svg` → Convert to `apparel.jpg` (1920x1080px)

### 2. Documentation Files
- ✅ `/public/IMAGE_SPECIFICATIONS.md` - Complete image specifications
- ✅ `/public/README_IMAGES.md` - Quick setup guide
- ✅ `/public/PLACEHOLDER_README.md` - Conversion instructions

### 3. Code Documentation
All components now include inline comments with image requirements:
- ✅ `HeroBanner.tsx` - Hero banner image specs
- ✅ `BannerCarousel.tsx` - Carousel banner specs
- ✅ `FeatureBanner.tsx` - Feature banner specs
- ✅ `page.tsx` - Home page image references

### 4. Utility Functions
- ✅ `src/utils/imagePlaceholders.ts` - Helper functions for placeholder images

## Image Size Reference

| Component | Width | Height | Aspect Ratio | Max File Size | Format |
|-----------|-------|--------|--------------|---------------|--------|
| Hero Banner | 1920px | 1080px | 16:9 | 500KB | JPG/WebP |
| Banner Carousel | 800px | 600px | 4:3 | 200KB | JPG/WebP |
| Feature Banner | 1920px | 1080px | 16:9 | 400KB | JPG/WebP |

## Next Steps

### For Development (Now)
The SVG placeholders will work for development. You'll see colored rectangles with text labels.

### For Production (Before Launch)
1. **Option A: Convert SVG to JPG**
   ```bash
   # Using ImageMagick
   cd public/hero
   for file in *.svg; do convert "$file" "${file%.svg}.jpg"; done
   ```

2. **Option B: Replace with Actual Images**
   - Create or source actual images matching the specifications
   - Optimize using TinyPNG or Squoosh
   - Place in the correct directories with correct filenames

3. **Option C: Use Placeholder Service (Temporary)**
   - See `src/utils/imagePlaceholders.ts` for helper functions
   - Use services like placehold.co for temporary images

## Quick Conversion Guide

### Using Online Converter
1. Visit https://cloudconvert.com/svg-to-jpg
2. Upload each SVG file
3. Set quality to 90%
4. Download and save as `.jpg` with the correct filename

### Using ImageMagick (Command Line)
```bash
# Install ImageMagick
brew install imagemagick  # macOS

# Convert all files
cd apps/web/public/hero
for file in *.svg; do convert "$file" "${file%.svg}.jpg"; done

cd ../banners
for file in *.svg; do convert "$file" "${file%.svg}.jpg"; done

cd ../featured
for file in *.svg; do convert "$file" "${file%.svg}.jpg"; done
```

## File Structure

```
apps/web/public/
├── hero/
│   ├── harry-potter-banner.svg (→ .jpg)
│   ├── lotr-banner.svg (→ .jpg)
│   └── got-banner.svg (→ .jpg)
├── banners/
│   ├── new-arrivals.svg (→ .jpg)
│   ├── best-sellers.svg (→ .jpg)
│   ├── limited-edition.svg (→ .jpg)
│   └── sale.svg (→ .jpg)
├── featured/
│   ├── collectibles.svg (→ .jpg)
│   └── apparel.svg (→ .jpg)
├── IMAGE_SPECIFICATIONS.md
├── README_IMAGES.md
└── PLACEHOLDER_README.md
```

## Component Usage

All components are ready to use. They reference `.jpg` files, so once you convert or replace the SVG files with JPG, everything will work automatically.

Example:
```tsx
<HeroBanner
  animationType="fade"
  autoPlay={true}
  autoPlayInterval={5000}
/>
```

The component will automatically load images from `/public/hero/*.jpg`

## Color Palette Reference

When creating actual images, use these brand colors:
- **Primary Purple:** `#4c1d95`
- **Secondary Purple:** `#7c3aed`
- **Indigo:** `#6366f1`
- **Amber:** `#d97706`
- **Gold:** `#fbbf24`

## Support

For detailed specifications, see:
- `/public/IMAGE_SPECIFICATIONS.md` - Complete documentation
- Component files - Inline comments with requirements
- `/src/utils/imagePlaceholders.ts` - Helper functions

---

**Status:** ✅ All placeholder images created and documented
**Action Required:** Convert SVG to JPG or replace with actual images before production

