# How to Get Your Admin Token from Browser

Since you're logged in to production, here's how to get your token:

## Method 1: Browser DevTools (Easiest)

1. **Open the production site:**
   - Go to: https://hos-marketplaceweb-production.up.railway.app
   - Make sure you're logged in

2. **Open DevTools:**
   - **Chrome/Edge:** Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - **Firefox:** Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - **Safari:** Enable Developer menu first, then `Cmd+Option+I`

3. **Go to Application/Storage tab:**
   - Click **"Application"** tab (Chrome) or **"Storage"** tab (Firefox)
   - In the left sidebar, expand **"Local Storage"**
   - Click on your domain: `https://hos-marketplaceweb-production.up.railway.app`

4. **Find the token:**
   - Look for keys like: `token`, `accessToken`, `authToken`, `jwt`, `bearer`
   - The value will be a long string starting with `eyJ...` (JWT token)
   - **Copy the entire value**

5. **Use it:**
   ```bash
   node check-production-via-api.js YOUR_COPIED_TOKEN_HERE
   ```

## Method 2: Network Tab

1. **Open DevTools** → **Network** tab
2. **Refresh the page** or navigate to any page
3. **Look for API requests** (filter by "api" or "auth")
4. **Click on any request** that shows 200 OK
5. **Go to "Headers"** tab
6. **Look for "Authorization" header:**
   - It will say: `Authorization: Bearer eyJ...`
   - Copy the part after `Bearer ` (the token)

## Method 3: Console (JavaScript)

1. **Open DevTools** → **Console** tab
2. **Type and press Enter:**
   ```javascript
   localStorage.getItem('token') || localStorage.getItem('accessToken') || localStorage.getItem('authToken')
   ```
3. **Copy the returned value**

## Method 4: Login via API (Get Fresh Token)

If you know the password for `mail@jsabu.com`:

```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mail@jsabu.com","password":"YOUR_PASSWORD"}'
```

The response will contain a `token` field - copy that value.
