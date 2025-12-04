# 🔧 Admin Login Troubleshooting

## ✅ SQL Update Was Successful

The database update completed successfully:
- ✅ Password hash updated
- ✅ Role set to ADMIN
- ✅ All fields correct

## ❌ But Login Still Returns 401

This suggests the API service might need to be restarted or there's a caching issue.

---

## 🔄 Solution 1: Restart API Service (Recommended)

### Via Railway Dashboard:

1. **Go to Railway Dashboard**
   - Visit: https://railway.app
   - Select project: **HOS-World Production Deployment**

2. **Open API Service**
   - Click on `@hos-marketplace/api` service

3. **Restart Service**
   - Go to **"Deployments"** tab
   - Click **"Redeploy"** or **"Restart"** button
   - Wait for service to restart (usually 1-2 minutes)

4. **Test Login Again**
   ```bash
   curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "app@houseofspells.co.uk", "password": "Admin123"}'
   ```

---

## 🔍 Solution 2: Verify Database Hash

Run this SQL to double-check the hash:

```sql
SELECT 
  email, 
  role, 
  LEFT(password, 10) as password_start,
  LENGTH(password) as password_length
FROM users 
WHERE email = 'app@houseofspells.co.uk';
```

**Expected Result:**
- `password_start` should be: `$2b$10$N9q`
- `password_length` should be: `60`
- `role` should be: `ADMIN`

If the hash doesn't start with `$2b$10$`, update it again:

```sql
UPDATE users
SET 
  password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  "updatedAt" = NOW()
WHERE email = 'app@houseofspells.co.uk';
```

---

## 🔍 Solution 3: Check API Logs

1. **Go to Railway Dashboard**
2. **Open API Service** → **"Logs"** tab
3. **Look for authentication errors** when you try to login
4. **Check for:**
   - Password comparison errors
   - Database connection issues
   - Any error messages related to authentication

---

## 🔍 Solution 4: Verify Password Hash Format

The password hash must be **exactly** this (no spaces, no truncation):

```
$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

**Check:**
- ✅ Starts with `$2b$` (not `b$` or `$b$`)
- ✅ Exactly 60 characters long
- ✅ No leading/trailing spaces
- ✅ No line breaks

---

## 🔍 Solution 5: Test Password Hash Directly

If you have access to run Node.js on Railway:

```bash
# Via Railway CLI
cd services/api
railway run node -e "const bcrypt = require('bcrypt'); const hash = '\$2b\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'; bcrypt.compare('Admin123', hash).then(result => console.log('Match:', result));"
```

This will verify if the hash matches the password.

---

## 🎯 Most Likely Solution

**Restart the API service** - This is the most common fix when database changes don't reflect immediately.

After restart:
1. Wait 1-2 minutes for service to be ready
2. Test login again
3. Should work now!

---

## 📋 Quick Checklist

- [ ] SQL update executed successfully
- [ ] Verified hash in database (starts with `$2b$10$`)
- [ ] API service restarted
- [ ] Waited for service to be ready
- [ ] Tested login again
- [ ] Checked API logs for errors

---

**After restarting the API service, the login should work!**

