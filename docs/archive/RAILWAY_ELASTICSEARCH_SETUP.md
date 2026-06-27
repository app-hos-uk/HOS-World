# 🔍 Elasticsearch Setup on Railway - Complete Guide

## Overview

This guide will help you deploy and configure Elasticsearch on Railway for your House of Spells Marketplace application.

**Current Status:**
- ✅ Elasticsearch code is fully implemented
- ✅ Search service is ready
- ⚠️ Elasticsearch instance needs to be deployed on Railway
- ⚠️ Environment variable needs to be configured

---

## 📋 Prerequisites

- Railway account (you already have this)
- Railway project with your HOS Marketplace application
- Basic understanding of Railway dashboard

---

## 🚀 Step 1: Deploy Elasticsearch on Railway

### Option A: Using Railway Template (Recommended)

1. **Go to Railway Dashboard**
   - Visit: https://railway.app
   - Login to your account

2. **Add New Service**
   - In your project dashboard, click **"+ New"** button
   - Select **"Template"** or **"Deploy from GitHub"**

3. **Search for Elasticsearch**
   - In the template search, type: `Elasticsearch`
   - Select the **Elasticsearch** template
   - Click **"Deploy"**

4. **Configure Elasticsearch Service**
   - Railway will create a new service
   - Wait for deployment to complete (2-5 minutes)
   - Service name will be something like: `elasticsearch` or `@elasticsearch`

### Option B: Using Docker (Alternative)

If Railway doesn't have a template:

1. **Create New Service**
   - Click **"+ New"** → **"Empty Service"**

2. **Configure Service**
   - Name: `elasticsearch`
   - Go to **Settings** → **Deploy**
   - Set **Source**: `Dockerfile` or `Docker Image`

3. **Use Docker Image**
   - Image: `docker.elastic.co/elasticsearch/elasticsearch:8.11.0`
   - Or: `elasticsearch:8.11.0` (community version)

4. **Add Environment Variables**
   ```
   discovery.type=single-node
   xpack.security.enabled=false
   ES_JAVA_OPTS=-Xms512m -Xmx512m
   ```

---

## 🔧 Step 2: Get Elasticsearch Connection URL

### After Deployment:

1. **Go to Elasticsearch Service**
   - Click on the Elasticsearch service in Railway dashboard

2. **Get Connection Details**
   - Go to **Variables** tab
   - Look for connection URL or create one:
     - Format: `http://[service-name].railway.internal:9200`
     - Or: `https://[public-url].railway.app:9200`

3. **Internal vs External URL**
   - **Internal URL** (Recommended): Use Railway's internal networking
     - Format: `http://elasticsearch.railway.internal:9200`
     - Faster, more secure, no public exposure
   - **External URL**: If you need public access
     - Get from **Settings** → **Networking** → **Public Domain**

### Railway Internal Networking

Railway services in the same project can communicate using:
- Service name as hostname
- Default port: `9200` for Elasticsearch
- Format: `http://[service-name]:9200`

**Example:**
- If your Elasticsearch service is named `elasticsearch`
- URL: `http://elasticsearch:9200`

---

## ⚙️ Step 3: Configure API Service

### Add Environment Variable

1. **Go to API Service**
   - Railway Dashboard → Your Project
   - Click on `@hos-marketplace/api` service

2. **Open Variables Tab**
   - Click **Variables** in the left sidebar

3. **Add Elasticsearch URL**
   - Click **"+ New Variable"**
   - **Key:** `ELASTICSEARCH_NODE`
   - **Value:** `http://elasticsearch:9200` (or your actual URL)
   - Click **Add**

4. **Optional: Enable Auto-Sync**
   - **Key:** `SYNC_PRODUCTS_ON_STARTUP`
   - **Value:** `true` (to sync existing products on startup)
   - Click **Add**

### Environment Variables Summary

Add these to `@hos-marketplace/api` service:

```env
ELASTICSEARCH_NODE=http://elasticsearch:9200
SYNC_PRODUCTS_ON_STARTUP=true
```

**Note:** 
- Replace `elasticsearch` with your actual service name if different
- Use internal URL for better performance and security
- Set `SYNC_PRODUCTS_ON_STARTUP=true` only for initial setup

---

## 🔄 Step 4: Redeploy API Service

After adding environment variables:

1. **Railway will auto-redeploy**
   - Railway detects variable changes
   - Automatically triggers a new deployment

2. **Or manually redeploy**
   - Go to **Deployments** tab
   - Click **"Redeploy"** or **"Deploy Latest"**

3. **Wait for deployment**
   - Usually takes 2-5 minutes
   - Monitor logs for Elasticsearch connection

---

## ✅ Step 5: Verify Elasticsearch Connection

### Check Railway Logs

1. **Go to API Service Logs**
   - Railway Dashboard → `@hos-marketplace/api`
   - Click **Deployments** → Latest deployment
   - View **Logs**

2. **Look for Success Messages**
   ```
   ✅ Success:
   [SearchService] Created Elasticsearch index: products
   [SearchService] Elasticsearch initialized successfully
   
   ⚠️ Warning (if not configured):
   [SearchService] ELASTICSEARCH_NODE not configured - search features will be disabled
   
   ❌ Error (if connection failed):
   [SearchService] Elasticsearch initialization failed: [error message]
   ```

### Test Elasticsearch Endpoint

1. **Check Elasticsearch Health**
   - If you have public URL: `curl https://your-elasticsearch-url.railway.app/_cluster/health`
   - Should return JSON with `"status":"green"` or `"status":"yellow"`

2. **Test Search API**
   - Make a request to your API: `GET /api/search?q=wand`
   - Should return search results (if products are indexed)

---

## 📊 Step 6: Sync Existing Products (Optional)

### Option A: Automatic Sync on Startup

If you set `SYNC_PRODUCTS_ON_STARTUP=true`:
- Products will sync automatically on next deployment
- Check logs for: `Starting full product sync to Elasticsearch...`

### Option B: Manual Sync via API

1. **Create Sync Endpoint** (if not exists)
   - Or use existing admin endpoint
   - Trigger product sync manually

2. **Or Use Prisma Studio**
   - Connect to database
   - Products will sync automatically when created/updated (via hooks)

---

## 🎯 Step 7: Verify Search Functionality

### Test Search Endpoint

```bash
# Test search
curl "https://your-api-url.railway.app/api/search?q=wand"

# Test with filters
curl "https://your-api-url.railway.app/api/search?q=wand&fandom=harry-potter&minPrice=10&maxPrice=100"
```

### Expected Response

```json
{
  "hits": [
    {
      "id": "...",
      "name": "Wand",
      "description": "...",
      "price": 29.99,
      ...
    }
  ],
  "total": 1,
  "aggregations": {
    "fandoms": [...],
    "categories": [...]
  }
}
```

---

## 🔍 Troubleshooting

### Issue: "ELASTICSEARCH_NODE not configured"

**Solution:**
- Verify `ELASTICSEARCH_NODE` is set in Railway variables
- Check variable name is exact (case-sensitive)
- Redeploy after adding variable

### Issue: "Elasticsearch connection timeout"

**Possible Causes:**
1. **Wrong URL format**
   - Use: `http://elasticsearch:9200` (internal)
   - Or: `https://your-service.railway.app:9200` (external)
   - Don't use `localhost` in production

2. **Service not ready**
   - Wait for Elasticsearch to fully deploy (2-5 minutes)
   - Check Elasticsearch service status in Railway

3. **Network issues**
   - Verify services are in the same Railway project
   - Check Railway internal networking is working

**Solution:**
- Verify Elasticsearch service is running
- Check service name matches URL
- Try using internal Railway URL format

### Issue: "Elasticsearch initialization failed"

**Check:**
1. Elasticsearch service logs in Railway
2. API service logs for detailed error
3. Verify Elasticsearch is accessible

**Solution:**
- Check Elasticsearch service health
- Verify URL is correct
- Check if Elasticsearch requires authentication (add credentials if needed)

### Issue: "Index creation failed"

**Solution:**
- Check Elasticsearch has enough memory
- Verify Elasticsearch version compatibility
- Check logs for specific error message

---

## 🔐 Security Considerations

### Production Recommendations

1. **Use Internal Networking**
   - Use Railway internal URLs (`http://elasticsearch:9200`)
   - Don't expose Elasticsearch publicly unless needed

2. **Enable Authentication** (Optional)
   - If using Elasticsearch 8.x, enable security
   - Add credentials to environment variables
   - Update connection URL to include credentials

3. **Restrict Access**
   - Only API service should access Elasticsearch
   - Use Railway's private networking

---

## 📈 Monitoring

### Check Elasticsearch Health

1. **Via Railway Logs**
   - Elasticsearch service → Logs
   - Look for health check messages

2. **Via API** (if public URL)
   ```bash
   curl https://your-elasticsearch-url.railway.app/_cluster/health
   ```

3. **Via Application Logs**
   - API service logs show Elasticsearch status
   - Search operations log success/failure

---

## 🎨 Advanced Configuration

### Custom Elasticsearch Settings

If you need custom settings, you can:

1. **Modify Search Service**
   - Edit `services/api/src/search/search.service.ts`
   - Update index settings in `createIndex()` method

2. **Add Authentication**
   - Update `services/api/src/search/search.module.ts`
   - Add `auth` configuration:
   ```typescript
   {
     node: configService.get('ELASTICSEARCH_NODE'),
     auth: {
       username: configService.get('ELASTICSEARCH_USERNAME'),
       password: configService.get('ELASTICSEARCH_PASSWORD'),
     }
   }
   ```

3. **Configure Cluster Settings**
   - Add environment variables for cluster configuration
   - Update connection settings in `search.module.ts`

---

## 📝 Summary Checklist

- [ ] Deploy Elasticsearch service on Railway
- [ ] Get Elasticsearch connection URL
- [ ] Add `ELASTICSEARCH_NODE` to API service variables
- [ ] (Optional) Add `SYNC_PRODUCTS_ON_STARTUP=true`
- [ ] Redeploy API service
- [ ] Verify connection in logs
- [ ] Test search endpoint
- [ ] (Optional) Sync existing products

---

## 🔗 Useful Links

- **Railway Dashboard:** https://railway.app
- **Elasticsearch Template:** https://railway.com/deploy/elasticsearch
- **Elasticsearch Docs:** https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html
- **NestJS Elasticsearch:** https://docs.nestjs.com/techniques/elasticsearch

---

## 📞 Next Steps

After Elasticsearch is set up:

1. ✅ Search functionality will be enabled
2. ✅ Products will be indexed automatically
3. ✅ Search API will return fast results
4. ✅ Filters and aggregations will work

**Your application will now have:**
- Fast full-text search
- Product filtering
- Search analytics
- Better search performance

---

**Last Updated:** December 3, 2025  
**Status:** Ready to deploy on Railway

