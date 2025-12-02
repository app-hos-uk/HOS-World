/**
 * Generate placeholder images for House of Spells Marketplace
 * Run with: node scripts/generate-placeholders.js
 * 
 * Note: This script creates simple colored placeholder images.
 * For production, replace these with actual high-quality images.
 */

const fs = require('fs');
const path = require('path');

// Create a simple SVG to JPG converter using canvas (if available)
// Otherwise, we'll create SVG placeholders that work in browsers

const colors = {
  purpleDark: '#4c1d95',
  purpleMedium: '#7c3aed',
  indigo: '#6366f1',
  amber: '#d97706',
  gold: '#fbbf24',
};

// Create SVG placeholder function
function createSVGPlaceholder(width, height, color, text) {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${color}"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="48" fill="white" 
        text-anchor="middle" dominant-baseline="middle" font-weight="bold">
    ${text}
  </text>
  <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.8)" 
        text-anchor="middle" dominant-baseline="middle">
    ${width}x${height}px
  </text>
</svg>`;
}

// Create directories
const publicDir = path.join(__dirname, '..', 'public');
const heroDir = path.join(publicDir, 'hero');
const bannersDir = path.join(publicDir, 'banners');
const featuredDir = path.join(publicDir, 'featured');

[heroDir, bannersDir, featuredDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

console.log('Generating placeholder images...\n');

// Hero Banner Images (1920x1080)
console.log('Creating hero banners...');
fs.writeFileSync(
  path.join(heroDir, 'harry-potter-banner.svg'),
  createSVGPlaceholder(1920, 1080, colors.purpleDark, 'Harry Potter Hero Banner')
);
fs.writeFileSync(
  path.join(heroDir, 'lotr-banner.svg'),
  createSVGPlaceholder(1920, 1080, colors.purpleMedium, 'Lord of the Rings Hero Banner')
);
fs.writeFileSync(
  path.join(heroDir, 'got-banner.svg'),
  createSVGPlaceholder(1920, 1080, colors.indigo, 'Game of Thrones Hero Banner')
);

// Banner Carousel Images (800x600)
console.log('Creating banner carousel images...');
fs.writeFileSync(
  path.join(bannersDir, 'new-arrivals.svg'),
  createSVGPlaceholder(800, 600, colors.purpleMedium, 'New Arrivals')
);
fs.writeFileSync(
  path.join(bannersDir, 'best-sellers.svg'),
  createSVGPlaceholder(800, 600, colors.amber, 'Best Sellers')
);
fs.writeFileSync(
  path.join(bannersDir, 'limited-edition.svg'),
  createSVGPlaceholder(800, 600, colors.gold, 'Limited Edition')
);
fs.writeFileSync(
  path.join(bannersDir, 'sale.svg'),
  createSVGPlaceholder(800, 600, colors.indigo, 'Sale Items')
);

// Feature Banner Images (1920x1080)
console.log('Creating feature banners...');
fs.writeFileSync(
  path.join(featuredDir, 'collectibles.svg'),
  createSVGPlaceholder(1920, 1080, colors.purpleDark, 'Exclusive Collectibles')
);
fs.writeFileSync(
  path.join(featuredDir, 'apparel.svg'),
  createSVGPlaceholder(1920, 1080, colors.purpleMedium, 'Magical Apparel')
);

// Create a README with instructions
const readmeContent = `# Placeholder Images

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
\`\`\`bash
cd public/hero
for file in *.svg; do convert "\$file" "\${file%.svg}.jpg"; done
\`\`\`

Or use an online converter like:
- https://cloudconvert.com/svg-to-jpg
- https://convertio.co/svg-jpg/

## Using Placeholder Services

You can also use placeholder services temporarily:
- https://via.placeholder.com/1920x1080/4c1d95/ffffff?text=Hero+Banner
- https://placehold.co/1920x1080/4c1d95/ffffff?text=Hero+Banner
`;

fs.writeFileSync(path.join(publicDir, 'PLACEHOLDER_README.md'), readmeContent);

console.log('\n✅ Placeholder images generated successfully!');
console.log('📝 Note: SVG files were created. Convert to JPG/WebP for production use.');
console.log('📖 See public/PLACEHOLDER_README.md for conversion instructions.');

