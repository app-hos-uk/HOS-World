# CDN Configuration Guide

## Overview

This guide covers CDN (Content Delivery Network) setup for House of Spells Marketplace to optimize static asset delivery and improve global performance.

## Recommended CDN Providers

### Option 1: AWS CloudFront (Recommended)
- Integrated with AWS S3
- Global edge locations
- DDoS protection
- SSL/TLS certificates included

### Option 2: Cloudflare
- Free tier available
- Easy DNS integration
- Built-in DDoS protection
- Image optimization

### Option 3: Google Cloud CDN
- Integrated with Google Cloud Storage
- Global network
- Advanced caching controls

## Implementation Strategy

### 1. Static Assets

#### Upload to CDN:
- Product images
- Seller logos
- Theme assets
- User avatars
- Document files

#### Cache Configuration:
```
Cache-Control: public, max-age=31536000, immutable
```

### 2. API Responses

#### Cacheable Endpoints:
- Product listings (public)
- Seller information (public)
- Theme configurations (public)

#### Cache Headers:
```
Cache-Control: public, max-age=300, s-maxage=600
```

### 3. Image Optimization

#### Formats:
- WebP (modern browsers)
- JPEG (fallback)
- PNG (transparency)

#### Sizes:
- Thumbnail: 200x200
- Medium: 600x600
- Large: 1200x1200
- Original: Full resolution

## AWS CloudFront Setup

### Step 1: Create S3 Bucket
```bash
aws s3 mb s3://hos-marketplace-assets
aws s3api put-bucket-cors --bucket hos-marketplace-assets --cors-configuration file://cors.json
```

### Step 2: Create CloudFront Distribution
```bash
aws cloudfront create-distribution \
  --origin-domain-name hos-marketplace-assets.s3.amazonaws.com \
  --default-root-object index.html \
  --enabled
```

### Step 3: Configure Cache Behaviors
- **Static Assets**: Cache for 1 year
- **API Responses**: Cache for 5 minutes
- **Images**: Cache for 1 year with versioning

### Step 4: SSL Certificate
- Use AWS Certificate Manager (ACM)
- Enable HTTPS redirect

## Cloudflare Setup

### Step 1: Add Domain
1. Sign up at cloudflare.com
2. Add your domain
3. Update DNS nameservers

### Step 2: Configure Caching Rules
1. Go to Rules > Page Rules
2. Add rules for static assets
3. Set cache level to "Cache Everything"

### Step 3: Enable Auto Minify
- CSS
- JavaScript
- HTML

### Step 4: Enable Image Optimization
- Polish: Lossy
- WebP: Enabled
- Image Resizing: Enabled

## CDN Integration in Application

### Environment Variables
```env
CDN_URL=https://cdn.hos-marketplace.com
CDN_ENABLED=true
```

### Image URL Generation
```typescript
const getImageUrl = (path: string, size?: 'thumb' | 'medium' | 'large') => {
  const cdnUrl = process.env.CDN_URL;
  const sizePrefix = size ? `${size}/` : '';
  return `${cdnUrl}/${sizePrefix}${path}`;
};
```

### Cache Headers Middleware
```typescript
// Static assets
res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

// API responses
res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
```

## Monitoring

### Key Metrics
- Cache hit ratio
- Response times
- Bandwidth usage
- Error rates

### Tools
- CloudFront: AWS CloudWatch
- Cloudflare: Analytics dashboard
- Custom: Application monitoring

## Best Practices

1. **Version Assets**: Use query parameters or filenames
   - `image.jpg?v=123`
   - `image-123.jpg`

2. **Compress Files**: Enable gzip/brotli compression

3. **Optimize Images**: Use WebP format when possible

4. **Set Proper TTLs**: Balance freshness vs performance

5. **Use CDN Purge**: Clear cache when content changes

6. **Monitor Performance**: Track cache hit rates

## Cache Invalidation

### Manual Purge
```typescript
// CloudFront
await cloudfront.createInvalidation({
  DistributionId: 'distribution-id',
  InvalidationBatch: {
    Paths: { Quantity: 1, Items: ['/products/*'] },
    CallerReference: Date.now().toString(),
  },
});
```

### Automatic Invalidation
- On product update: Purge product images
- On seller update: Purge seller logo
- On theme update: Purge theme assets

## Performance Targets

- **Static Assets**: < 100ms response time
- **API Responses**: < 200ms response time
- **Image Loading**: < 500ms for thumbnails
- **Cache Hit Ratio**: > 80%

## Testing

### CDN Testing Tools
- WebPageTest
- GTmetrix
- Pingdom
- Lighthouse

### Checklist
- [ ] Static assets served from CDN
- [ ] HTTPS enabled
- [ ] Cache headers configured
- [ ] Image optimization enabled
- [ ] Compression enabled
- [ ] Error pages configured
- [ ] Monitoring set up

## Next Steps

1. Choose CDN provider
2. Set up CDN infrastructure
3. Configure cache behaviors
4. Update application to use CDN URLs
5. Monitor performance
6. Optimize based on metrics

