# 🔍 Final Verification - Admin Login

## ❌ Still Getting 401 - Let's Verify Everything

---

## ✅ Step 1: Verify Password Hash in Database

**In Railway Dashboard → PostgreSQL → Data → users table:**

1. Click on the user row with `app@houseofspells.co.uk`
2. Click **Edit**
3. Look at the **password** field
4. **Copy the EXACT value** (select all and copy)

**It should be EXACTLY:**
```
[bcrypt-hash-redacted]
```

**Check:**
- ✅ Starts with `$2b$10$` (not `b$10$` or `$b$10$`)
- ✅ Exactly 60 characters long
- ✅ No spaces before or after
- ✅ Ends with `lhWy`

**If it's different:**
- Replace it with the exact value above
- Click **Save**

---

## ✅ Step 2: Verify Frontend API URL

**In Railway Dashboard → `@hos-marketplace/web` → Variables:**

1. Find `NEXT_PUBLIC_API_URL`
2. Click the **eye icon** to reveal the value
3. **It should be:**
   ```
   https://hos-marketplaceapi-production.up.railway.app/api
   ```

**If it's different:**
1. Click the three-dot menu (⋮) next to the variable
2. Click **Edit**
3. Set value to: `https://hos-marketplaceapi-production.up.railway.app/api`
4. Click **Save**
5. **Redeploy** the frontend service

---

## ✅ Step 3: Verify API Service is Running

**In Railway Dashboard → `@hos-marketplace/api` → Logs:**

1. Check recent logs
2. Look for:
   - ✅ "Database connected successfully"
   - ✅ "Server is listening on port..."
   - ❌ Any error messages

**If there are errors:**
- Restart the API service
- Wait 2-3 minutes

---

## 🧪 Step 4: Test Again

**After verifying all above, test login:**

```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "app@houseofspells.co.uk", "password": "`$SEED_ADMIN_PASSWORD` (env)"}'
```

---

## 🔍 Debug: Check API Logs During Login

1. Railway Dashboard → `@hos-marketplace/api` → Logs
2. Keep the logs tab open
3. Run the login curl command
4. Watch the logs for:
   - Database queries
   - Password comparison results
   - Any error messages

**Look for:**
- "Invalid credentials" messages
- Database connection errors
- Password hash comparison errors

---

## 💡 Alternative: Try Creating User with Different Password

If login still fails, try creating a new admin user with a different password:

1. **Delete existing user** in database
2. **Create new user** with:
   - Email: `admin@houseofspells.co.uk`
   - Password: ``$TEST_SEED_PASSWORD` (env)`
   - Role: `ADMIN`

3. **Generate hash for ``$TEST_SEED_PASSWORD` (env)`:**
   - Use: https://bcrypt-generator.com/
   - Or run: `node -e "const bcrypt = require('bcrypt'); bcrypt.hash('`$TEST_SEED_PASSWORD` (env)', 10).then(hash => console.log(hash));"`

4. **Test login with new credentials**

---

## 📋 Verification Checklist

- [ ] Password hash in database is exactly `[bcrypt-hash-redacted]`
- [ ] Password hash is 60 characters long
- [ ] Password hash starts with `$2b$10$`
- [ ] `NEXT_PUBLIC_API_URL` = `https://hos-marketplaceapi-production.up.railway.app/api`
- [ ] API service is running (check logs)
- [ ] API service restarted after database changes
- [ ] Tested login again

---

**Please verify the password hash value in the database and share what you see!**

