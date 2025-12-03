# How to Force Railway to Rebuild Without Cache

Railway doesn't have a direct "Clear Cache" button, but here are ways to force a fresh build:

## Method 1: Disconnect and Reconnect Repository (Most Reliable)

1. **Go to Railway Dashboard**
   - Open your project
   - Click on `@hos-marketplace/web` service
   - Go to **Source** tab

2. **Disconnect Repository**
   - Click **"Disconnect Repository"** or **"..."** menu → **"Disconnect"**
   - Confirm the disconnection

3. **Reconnect Repository**
   - Click **"Connect Repository"**
   - Select: `app-hos-uk/HOS-World`
   - Select branch: `master`
   - Enable **"Auto Deploy"**
   - Click **"Connect"**

4. **Result**
   - Railway will trigger a fresh build
   - All cache layers will be invalidated
   - This is the most reliable method

## Method 2: Make a Small Code Change

**Add a comment or whitespace change:**
```bash
# Add a comment to Dockerfile
echo "# Cache-bust: $(date)" >> apps/web/Dockerfile
git add apps/web/Dockerfile
git commit -m "Force cache invalidation"
git push
```

## Method 3: Use Railway CLI (If Installed)

```bash
# Install Railway CLI if not installed
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Deploy with --no-cache flag (if available)
railway up --no-cache
```

## Method 4: Modify Dockerfile Comment

**Update the cache-bust comment in Dockerfile:**
- Change the timestamp/comment at the top
- This forces Docker to invalidate the cache from that layer down

## Method 5: Delete and Recreate Service (Last Resort)

⚠️ **Warning: This will lose deployment history**

1. Create a new service
2. Connect the same repository
3. Copy all environment variables
4. Deploy

## Recommended Approach

**Use Method 1 (Disconnect/Reconnect)** - It's the most reliable and doesn't require code changes.

## Verification

After forcing a fresh build, check the build logs:
- Should see "uncached" or fresh downloads
- No "cached" messages for COPY steps
- Verification steps should pass

## Why This Happens

Railway uses Docker layer caching to speed up builds. When files don't change, Docker reuses cached layers. Sometimes the cache can be stale, especially after multiple fixes.

## Prevention

- The cache-busting ARG and BUILD_DATE we added should help
- Making small changes to Dockerfile comments can force cache invalidation
- Railway will eventually expire old cache layers automatically

