# Cloudflare CDN Setup Guide

## Overview

This guide walks you through setting up Cloudflare CDN for House of Spells Marketplace to optimize static asset delivery.

## Prerequisites

- Domain name registered
- DNS access to your domain
- Cloudflare account (free tier works)

## Step-by-Step Setup

### Step 1: Sign Up for Cloudflare

1. Go to [cloudflare.com](https://www.cloudflare.com)
2. Sign up for a free account
3. Verify your email

### Step 2: Add Your Domain

1. Click "Add a Site" in the dashboard
2. Enter your domain (e.g., `hos-marketplace.com`)
3. Select the Free plan
4. Cloudflare will scan your DNS records

### Step 3: Update DNS Nameservers

1. Cloudflare will provide you with two nameservers:
   - Example: `sue.ns.cloudflare.com`
   - Example: `ted.ns.cloudflare.com`
2. Go to your domain registrar
3. Update nameservers to Cloudflare's nameservers
4. Wait for DNS propagation (usually 5-30 minutes)

### Step 4: Configure DNS Records

In Cloudflare DNS settings, add/edit:

```
Type    Name    Content                    Proxy Status
A       @       YOUR_SERVER_IP             Proxied (orange cloud)
A       www     YOUR_SERVER_IP             Proxied (orange cloud)
CNAME   api     api.hos-marketplace.com    Proxied
CNAME   cdn     cdn.hos-marketplace.com    Proxied
```

**Important**: Enable "Proxy" (orange cloud) for CDN benefits

### Step 5: SSL/TLS Configuration

1. Go to SSL/TLS settings
2. Set encryption mode to "Full" or "Full (strict)"
3. Enable "Always Use HTTPS"
4. Enable "Automatic HTTPS Rewrites"

### Step 6: Configure Caching Rules

#### Page Rules for Static Assets

Create page rules:

**Rule 1: Cache Static Assets**
- URL Pattern: `*cdn.hos-marketplace.com/*`
- Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
  - Browser Cache TTL: 1 month

**Rule 2: Cache Product Images**
- URL Pattern: `*/images/products/*`
- Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month

**Rule 3: API Responses (Public)**
- URL Pattern: `*api.hos-marketplace.com/api/products*`
- Settings:
  - Cache Level: Standard
  - Edge Cache TTL: 5 minutes

### Step 7: Enable Performance Features

#### Auto Minify
1. Go to Speed > Optimization
2. Enable:
   - JavaScript
   - CSS
   - HTML

#### Image Optimization
1. Go to Speed > Optimization
2. Enable:
   - Polish: Lossy (or Lossless)
   - WebP: Enabled
   - Image Resizing: Enabled

#### Brotli Compression
1. Go to Speed > Optimization
2. Enable Brotli compression

### Step 8: Configure Cache Headers

In your application, set proper cache headers:

```typescript
// Static assets (images, CSS, JS)
res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

// API responses (public data)
res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');

// Private data (user-specific)
res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
```

### Step 9: Environment Variables

Update your `.env` file:

```env
CDN_URL=https://cdn.hos-marketplace.com
CDN_ENABLED=true
CLOUDFLARE_ZONE_ID=your-zone-id
CLOUDFLARE_API_TOKEN=your-api-token
```

### Step 10: Test CDN

1. Check if assets are served from Cloudflare:
   ```bash
   curl -I https://cdn.hos-marketplace.com/images/product.jpg
   ```

2. Look for headers:
   - `cf-cache-status: HIT` (cached)
   - `cf-ray: XXXXX` (Cloudflare header)
   - `server: cloudflare`

## Cache Purge

### Purge via Dashboard
1. Go to Caching > Configuration
2. Click "Purge Everything" or "Custom Purge"
3. Enter URLs to purge

### Purge via API

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://cdn.hos-marketplace.com/images/product-123.jpg"]}'
```

### Purge in Application

Create a purge utility:

```typescript
async function purgeCloudflareCache(urls: string[]) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files: urls }),
    }
  );
  return response.json();
}
```

## Security Features

### Enable Security Settings
1. **Security Level**: Medium or High
2. **Challenge Passage**: 30 minutes
3. **Browser Integrity Check**: Enabled
4. **Privacy Pass Support**: Enabled

### Rate Limiting
1. Go to Security > WAF
2. Create rate limiting rules:
   - Limit requests per IP
   - Block suspicious patterns
   - Protect API endpoints

### DDoS Protection
- Automatically enabled
- Cloudflare filters traffic before it reaches your server

## Monitoring

### Analytics
1. Go to Analytics > Web Analytics
2. Monitor:
   - Request rates
   - Cache hit ratio
   - Bandwidth saved
   - Response times

### Alerts
1. Go to Notifications
2. Set up alerts for:
   - High error rates
   - DDoS attacks
   - Cache purges

## Best Practices

1. **Version Assets**: Use query parameters or filenames
   - `image.jpg?v=123`
   - `image-123.jpg`

2. **Set Proper TTLs**: Balance freshness vs performance

3. **Monitor Cache Hit Ratio**: Aim for > 80%

4. **Purge Strategically**: Only purge when content changes

5. **Use Different Domains**: 
   - `cdn.hos-marketplace.com` for static assets
   - `api.hos-marketplace.com` for API

## Performance Targets

- **Cache Hit Ratio**: > 80%
- **Response Time**: < 100ms
- **Bandwidth Saved**: > 60%
- **Uptime**: 99.99%

## Troubleshooting

### Assets Not Caching
- Check cache headers
- Verify page rules
- Ensure orange cloud is enabled

### SSL Errors
- Check SSL/TLS mode
- Verify certificate status
- Wait for certificate propagation

### High Cache Miss Rate
- Review cache headers
- Check TTL settings
- Verify purge frequency

## Next Steps

1. Monitor performance for 1 week
2. Adjust cache rules based on metrics
3. Optimize images further
4. Set up additional security rules
5. Configure alerts

## Resources

- [Cloudflare Dashboard](https://dash.cloudflare.com)
- [Cloudflare API Docs](https://developers.cloudflare.com/api)
- [Cache Best Practices](https://developers.cloudflare.com/cache/)

