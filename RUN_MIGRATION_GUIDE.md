# 🔄 Run Database Migration - Step by Step Guide

## ✅ You're Logged In!

Great! Now let's run the migration to add the missing database columns and tables.

## 🎯 Migration Endpoint

**Endpoint:** `POST /api/admin/migration/run-global-features`

**Requires:** Admin authentication (you're already logged in!)

---

## 📋 Method 1: Using Browser Console (Easiest)

1. **Stay logged in** on the admin dashboard
2. **Open Browser DevTools** (F12 or Cmd+Option+I)
3. **Go to Console tab**
4. **Paste this code and press Enter:**

```javascript
fetch('https://hos-marketplaceapi-production.up.railway.app/api/admin/migration/run-global-features', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
  }
})
.then(response => response.json())
.then(data => {
  console.log('✅ Migration Result:', data);
  if (data.success) {
    console.log('🎉 Migration completed successfully!');
    console.log('Summary:', data.summary);
  } else {
    console.error('❌ Migration failed:', data.error);
  }
})
.catch(error => {
  console.error('❌ Error:', error);
});
```

5. **Check the console output** - you should see the migration result

---

## 📋 Method 2: Using curl (Terminal)

If you have your JWT token, you can run:

```bash
curl -X POST \
  https://hos-marketplaceapi-production.up.railway.app/api/admin/migration/run-global-features \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**To get your token:**
1. Open Browser DevTools → Application/Storage tab
2. Look in `localStorage` or `sessionStorage` for `token` or `authToken`
3. Copy the token value
4. Replace `YOUR_JWT_TOKEN_HERE` in the curl command

---

## 📋 Method 3: Using Postman/Insomnia

1. **Create new POST request**
2. **URL:** `https://hos-marketplaceapi-production.up.railway.app/api/admin/migration/run-global-features`
3. **Headers:**
   - `Content-Type: application/json`
   - `Authorization: Bearer YOUR_JWT_TOKEN`
4. **Send request**

---

## ✅ Expected Response

**Success:**
```json
{
  "success": true,
  "message": "Migration completed",
  "summary": {
    "totalStatements": 50,
    "successful": 48,
    "errors": 2
  },
  "verification": {
    "countryColumnExists": true
  },
  "details": [...]
}
```

**Failure:**
```json
{
  "success": false,
  "error": "Error message",
  "message": "Migration failed. Check logs for details."
}
```

---

## 🔍 Verify Migration

After running the migration, verify it worked:

**In Browser Console:**
```javascript
fetch('https://hos-marketplaceapi-production.up.railway.app/api/admin/migration/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
  }
})
.then(response => response.json())
.then(data => {
  console.log('✅ Verification Result:', data);
  if (data.allColumnsPresent) {
    console.log('🎉 All columns and tables are present!');
  }
});
```

---

## 🐛 Troubleshooting

### Error: 401 Unauthorized
- **Cause:** Token expired or invalid
- **Fix:** Log out and log back in, then try again

### Error: 403 Forbidden
- **Cause:** User doesn't have ADMIN role
- **Fix:** Make sure you're logged in as an admin user

### Error: 500 Internal Server Error
- **Cause:** Database connection issue or SQL error
- **Fix:** Check Railway logs for detailed error message

### Migration shows errors but completes
- **Normal:** Some statements may fail if they already exist (idempotent)
- **Check:** Look at `summary.errors` - if it's low, migration likely succeeded

---

## 📝 What the Migration Does

The migration adds:
- ✅ `country` column to `users` table
- ✅ `currencyPreference` column to `users` table
- ✅ `gdprConsent` column to `users` table
- ✅ `currency_exchange_rates` table
- ✅ `gdpr_consent_logs` table
- ✅ Other schema updates

---

## 🎯 After Migration

Once migration completes:
1. **Refresh the page** - errors should be reduced
2. **Currency endpoints** should work (no more 500 errors)
3. **Admin features** should be accessible

---

**Status:** 🟡 Ready to run migration → 🟢 Migration complete → ✅ Errors resolved
