# 🚀 Elasticsearch on Railway - Quick Start

## 5-Minute Setup Guide

### Step 1: Deploy Elasticsearch (2 minutes)

1. Railway Dashboard → Your Project
2. Click **"+ New"** → **"Template"**
3. Search: `Elasticsearch` → Click **"Deploy"**
4. Wait for deployment (2-5 minutes)

### Step 2: Get Connection URL (1 minute)

1. Click on Elasticsearch service
2. Note the service name (e.g., `elasticsearch`)
3. Internal URL format: `http://[service-name]:9200`
   - Example: `http://elasticsearch:9200`

### Step 3: Configure API Service (1 minute)

1. Railway Dashboard → `@hos-marketplace/api` service
2. Go to **Variables** tab
3. Add variable:
   - **Key:** `ELASTICSEARCH_NODE`
   - **Value:** `http://elasticsearch:9200` (replace with your service name)
4. Click **Add**

### Step 4: Verify (1 minute)

1. Railway will auto-redeploy API service
2. Check logs for: `[SearchService] Elasticsearch initialized successfully`
3. Done! ✅

---

## Environment Variables

Add to `@hos-marketplace/api` service:

```env
ELASTICSEARCH_NODE=http://elasticsearch:9200
```

**Optional:**
```env
SYNC_PRODUCTS_ON_STARTUP=true  # Sync existing products on startup
```

---

## Verification

**Check Logs:**
- Railway → `@hos-marketplace/api` → Deployments → Logs
- Look for: `Elasticsearch initialized successfully`

**Test Search:**
```bash
curl "https://your-api-url.railway.app/api/search?q=wand"
```

---

## Troubleshooting

**Not connecting?**
- Verify service name in URL matches Elasticsearch service name
- Check Elasticsearch service is running
- Use internal URL format: `http://[service-name]:9200`

**Need help?**
- See full guide: `RAILWAY_ELASTICSEARCH_SETUP.md`

---

**That's it!** Your search is now powered by Elasticsearch. 🎉

