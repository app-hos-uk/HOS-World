# Placeholder Images

These are temporary placeholder images. Replace them with actual high-quality images before production.

## Image Requirements

### Hero Banners (public/hero/)
- Format: JPG or WebP
- Size: 1920x1080px
- Max file size: 500KB

### Banner Carousel (public/banners/)
- Format: JPG or WebP
- Size: 800x600px
- Max file size: 200KB

### Feature Banners (public/featured/)
- Format: JPG or WebP
- Size: 1920x1080px
- Max file size: 400KB

## Converting SVG to JPG

If you have ImageMagick installed:
```bash
cd public/hero
for file in *.svg; do convert "$file" "${file%.svg}.jpg"; done
```

Or use an online converter like:
- https://cloudconvert.com/svg-to-jpg
- https://convertio.co/svg-jpg/

## Using Placeholder Services

You can also use placeholder services temporarily:
- https://via.placeholder.com/1920x1080/4c1d95/ffffff?text=Hero+Banner
- https://placehold.co/1920x1080/4c1d95/ffffff?text=Hero+Banner
