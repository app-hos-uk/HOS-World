# 🔍 Elasticsearch Railway Configuration

## From Your Railway Dashboard

Based on your Elasticsearch service configuration:

### Service Name
**`Elasticsearch`** (Railway internal networking uses lowercase: `elasticsearch`)

### Internal URL
**`http://elasticsearch:9200`**

### Authentication Required
Your Elasticsearch instance has authentication enabled:
- **Username:** `elastic`
- **Password:** `0s2b8jhktuk50wzg73q7rdpprlw8xu1t`

---

## ⚙️ Environment Variables to Add

Add these to your `@hos-marketplace/api` service in Railway:

### Required Variables

1. **ELASTICSEARCH_NODE**
   - **Value:** `http://elasticsearch:9200`
   - This is the internal Railway URL

2. **ELASTICSEARCH_USERNAME**
   - **Value:** `elastic`
   - From your Elasticsearch service variables

3. **ELASTICSEARCH_PASSWORD**
   - **Value:** `0s2b8jhktuk50wzg73q7rdpprlw8xu1t`
   - From your Elasticsearch service variables

### Optional Variable

4. **SYNC_PRODUCTS_ON_STARTUP**
   - **Value:** `true` (to sync existing products on first startup)
   - Can be removed after initial sync

---

## 📝 Step-by-Step Configuration

### Step 1: Go to API Service
1. Railway Dashboard → Your Project
2. Click on `@hos-marketplace/api` service

### Step 2: Add Variables
1. Go to **Variables** tab
2. Click **"+ New Variable"** for each:

   **Variable 1:**
   - Key: `ELASTICSEARCH_NODE`
   - Value: `http://elasticsearch:9200`
   - Click **Add**

   **Variable 2:**
   - Key: `ELASTICSEARCH_USERNAME`
   - Value: `elastic`
   - Click **Add**

   **Variable 3:**
   - Key: `ELASTICSEARCH_PASSWORD`
   - Value: `0s2b8jhktuk50wzg73q7rdpprlw8xu1t`
   - Click **Add** (mark as sensitive/secret if option available)

   **Variable 4 (Optional):**
   - Key: `SYNC_PRODUCTS_ON_STARTUP`
   - Value: `true`
   - Click **Add**

### Step 3: Verify
1. Railway will automatically redeploy
2. Check logs for: `[SearchService] Elasticsearch initialized successfully`

---

## ✅ Verification

### Check Logs
Railway Dashboard → `@hos-marketplace/api` → Deployments → Latest → Logs

**Success Message:**
```
[SearchService] Created Elasticsearch index: products
[SearchService] Elasticsearch initialized successfully
```

**If Authentication Fails:**
```
[SearchService] Elasticsearch initialization failed: [authentication error]
```

### Test Search
```bash
curl "https://your-api-url.railway.app/api/search?q=wand"
```

---

## 🔒 Security Note

The `ELASTICSEARCH_PASSWORD` is sensitive. Railway should automatically mark it as a secret variable. If not:
- Don't commit it to git
- Keep it secure in Railway variables only
- Consider rotating it periodically

---

## 📋 Summary

**Service Name:** `elasticsearch` (lowercase for internal networking)  
**Internal URL:** `http://elasticsearch:9200`  
**Authentication:** Required (username: `elastic`, password: from variables)

**Variables to Add:**
- `ELASTICSEARCH_NODE=http://elasticsearch:9200`
- `ELASTICSEARCH_USERNAME=elastic`
- `ELASTICSEARCH_PASSWORD=0s2b8jhktuk50wzg73q7rdpprlw8xu1t`
- `SYNC_PRODUCTS_ON_STARTUP=true` (optional)

---

**Code Updated:** The search module now supports authentication automatically when credentials are provided.

