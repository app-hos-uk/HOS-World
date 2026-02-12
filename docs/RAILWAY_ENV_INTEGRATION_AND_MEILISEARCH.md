# Configuring INTEGRATION_ENCRYPTION_KEY and Meilisearch on Railway

This guide walks you through setting **INTEGRATION_ENCRYPTION_KEY** and **Meilisearch** (MEILISEARCH_HOST) for your API service on Railway.

---

## 1. INTEGRATION_ENCRYPTION_KEY (recommended for production)

This key is used to encrypt sensitive data (e.g. third-party API credentials, webhook secrets) stored by your app. Without it, the API uses a temporary development key, which is **not safe for production**.

### Requirements

- **Format:** Exactly **64 characters**, hexadecimal (0–9, a–f).
- **Meaning:** 32 bytes of key material for AES-256-GCM.

### Step 1: Generate a secure key

On your machine (Node.js installed):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Example output (do **not** use this one; generate your own):

```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

Copy the full 64-character string.

### Step 2: Set the variable in Railway (API service)

**Option A – Railway Dashboard**

1. Open [Railway Dashboard](https://railway.app/dashboard).
2. Select your project (e.g. **HOS-World Production Deployment**).
3. Click the **API** service (`@hos-marketplace/api`).
4. Go to the **Variables** tab.
5. Click **+ New Variable** or **Add Variable**.
6. **Variable name:** `INTEGRATION_ENCRYPTION_KEY`
7. **Value:** paste your 64-character hex string (no quotes, no spaces).
8. Save. Railway will redeploy the API service with the new variable.

**Option B – Railway CLI**

From your project root, with the API service linked:

```bash
railway service "@hos-marketplace/api"
railway variables set INTEGRATION_ENCRYPTION_KEY="<paste-your-64-char-hex-here>"
```

Replace `<paste-your-64-char-hex-here>` with the key you generated. The API will redeploy automatically.

### Step 3: Verify

After the redeploy, check API logs. You should see:

- **Before:** `INTEGRATION_ENCRYPTION_KEY not set. Generating a temporary key for development...`
- **After:** `Encryption key initialized successfully` (or no warning about the key).

### Important

- **Do not rotate this key** unless you are prepared to re-encrypt or discard existing encrypted data (e.g. stored integration credentials). Old data encrypted with the previous key cannot be decrypted with a new key.
- Keep the key secret. Never commit it to git or expose it in client-side code.

---

## 2. Meilisearch (MEILISEARCH_HOST) – optional full-text search

If **MEILISEARCH_HOST** is not set, the API uses database-backed search (fallback). Setting it enables Meilisearch for faster, typo-tolerant product search.

You need:

- **MEILISEARCH_HOST** – Meilisearch URL (required when using Meilisearch).
- **MEILISEARCH_API_KEY** – Optional; set only if your Meilisearch instance has a master key.

### Option A: Meilisearch on Railway via CLI (recommended)

From your project root (project already linked with `railway link`):

1. **Add the Meilisearch service** (Docker image + master key + production env):

   ```bash
   # Generate a master key (save it somewhere secure, e.g. password manager)
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

   # Add Meilisearch service (replace YOUR_MASTER_KEY with the generated key)
   railway add
   # When prompted: choose "Docker Image", image: getmeili/meilisearch:v1.11
   # Add variables: MEILI_MASTER_KEY=<YOUR_MASTER_KEY>, MEILI_ENV=production
   # Service name: meilisearch
   ```

   Or in one go (paste your key):

   ```bash
   railway add --service meilisearch --image getmeili/meilisearch:v1.11 \
     --variables "MEILI_MASTER_KEY=YOUR_64_CHAR_HEX_KEY" \
     --variables "MEILI_ENV=production"
   ```

2. **Attach a volume** (so data persists across deploys):

   ```bash
   railway service meilisearch
   railway volume add -m /meili_data
   # When prompted for mount path, enter: /meili_data
   ```

3. **Expose the service** (public URL on port 7700):

   ```bash
   railway domain --port 7700
   ```
   Copy the printed URL (e.g. `https://meilisearch-production-xxxx.up.railway.app`).

4. **Tell Railway to route traffic to port 7700** (Meilisearch’s default):

   ```bash
   railway service meilisearch
   railway variables set PORT=7700
   railway redeploy --yes
   ```

5. **Configure the API service** to use Meilisearch:

   ```bash
   railway service "@hos-marketplace/api"
   railway variables set MEILISEARCH_HOST="https://meilisearch-production-xxxx.up.railway.app"
   railway variables set MEILISEARCH_API_KEY="YOUR_MASTER_KEY_SAME_AS_ABOVE"
   ```

   The API will redeploy and connect to Meilisearch on startup.

6. **Verify**: `curl -H "Authorization: Bearer YOUR_MASTER_KEY" https://your-meilisearch-url/health` should return `{"status":"available"}`.

**Important:** Store the Meilisearch master key (MEILI_MASTER_KEY / MEILISEARCH_API_KEY) in a password manager; you need it for the API and for direct Meilisearch access.

### Option B: Meilisearch on Railway (Dashboard)

1. In your Railway project, click **+ New**.
2. Choose **Database** (or **Plugin** if available) and add **Meilisearch**.
3. After it’s created, open the Meilisearch service and go to **Variables** or **Connect**.
4. Copy the **public URL** (e.g. `https://meilisearch-production-xxxx.up.railway.app`).  
   Use the URL exactly as shown (with `https://` and no trailing slash, unless Railway shows one).
5. In the **API** service, go to **Variables** and add:
   - **Name:** `MEILISEARCH_HOST`  
   - **Value:** that URL (e.g. `https://meilisearch-production-xxxx.up.railway.app`)
6. If Railway generated an API/key for Meilisearch, add it to the API service as:
   - **Name:** `MEILISEARCH_API_KEY`  
   - **Value:** the key
7. Save. The API service will redeploy and connect to Meilisearch on startup.

### Option C: Meilisearch Cloud (hosted)

1. Sign up at [Meilisearch Cloud](https://www.meilisearch.com/cloud).
2. Create a project and get:
   - **Host** URL (e.g. `https://xxx.meilisearch.io`).
   - **API Key** (e.g. master key) if required.
3. In Railway → **API** service → **Variables**:
   - `MEILISEARCH_HOST` = your Meilisearch host URL.
   - `MEILISEARCH_API_KEY` = the API key (if you use one).

### Option D: Self-hosted or other provider

- **MEILISEARCH_HOST** = full URL (e.g. `https://search.yourdomain.com` or `http://your-meilisearch-host:7700`).
- **MEILISEARCH_API_KEY** = set only if the instance is protected with a master key.

### Verify Meilisearch

After setting variables and redeploying:

- **If configured correctly:** The “Meilisearch not configured” warning disappears from API logs, and product search uses Meilisearch.
- **If connection fails:** Check API logs for Meilisearch/health errors; confirm URL and optional API key are correct and that the Meilisearch service is reachable from Railway (e.g. same project or allowed network).

### Notes

- The API creates/updates the `products` index and syncs product data to Meilisearch when it’s configured.
- Without Meilisearch, search still works via the database fallback.

---

## Quick reference

| Variable                     | Service | Required | Format / notes                                      |
|-----------------------------|--------|----------|-----------------------------------------------------|
| INTEGRATION_ENCRYPTION_KEY  | API    | Yes (prod) | 64-character hex (32 bytes)                      |
| MEILISEARCH_HOST            | API    | No       | Meilisearch URL (e.g. `https://xxx.up.railway.app`) |
| MEILISEARCH_API_KEY         | API    | No       | Only if Meilisearch has a master key               |

After changing variables, the API service will redeploy automatically. Use the steps above to confirm both the encryption key and Meilisearch (if used) are active.
