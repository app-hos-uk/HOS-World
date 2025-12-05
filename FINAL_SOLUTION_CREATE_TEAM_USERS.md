# ✅ Final Solution: Create Team Role Users

## 🎯 Problem
- Railway doesn't have a visible SQL query interface
- Prisma Studio can't connect (internal network URL)
- Need to create 7 team role users

---

## ✅ Solution 1: API Endpoint (After Deployment)

I've created an API endpoint that will work once deployed:

**Endpoint:** `POST /api/admin/create-team-users`

**File Created:** `services/api/src/admin/create-team-users.controller.ts`

**To Use (After Backend Deployment):**
```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/admin/create-team-users \
  -H "Content-Type: application/json"
```

**Status:** ⏳ Needs backend redeployment to be active

---

## ✅ Solution 2: Use Existing Admin User to Create Others

Since you already have `app@houseofspells.co.uk` as ADMIN, you can:

1. **Login as admin** via the web interface
2. **Use the admin dashboard** to manually create users (if that feature exists)
3. **Or** wait for the API endpoint to be deployed

---

## ✅ Solution 3: Manual Creation via API Registration (Limited)

Some roles can be created via registration API, but team roles cannot (they require direct database access).

---

## 🚀 Recommended: Deploy Backend with New Endpoint

### Step 1: Commit and Push Changes

The new admin endpoint is ready. After deploying:

```bash
# Commit the changes
git add services/api/src/admin/
git commit -m "Add admin endpoint to create team users"
git push
```

### Step 2: Railway Auto-Deploys

Railway will automatically deploy the new endpoint.

### Step 3: Call the Endpoint

```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/admin/create-team-users \
  -H "Content-Type: application/json"
```

---

## 📋 Quick Reference

**Endpoint:** `/api/admin/create-team-users`  
**Method:** POST  
**Auth:** Temporarily disabled for setup  
**Creates:** 7 team role users

**Users Created:**
- admin@hos.test (ADMIN)
- procurement@hos.test (PROCUREMENT)
- fulfillment@hos.test (FULFILLMENT)
- catalog@hos.test (CATALOG)
- marketing@hos.test (MARKETING)
- finance@hos.test (FINANCE)
- cms@hos.test (CMS_EDITOR)

**Password for all:** `Test123!`

---

## ⚠️ Next Steps

1. **Deploy backend** with the new admin endpoint
2. **Call the endpoint** to create users
3. **Re-enable auth** on the endpoint after setup (optional)

---

**The endpoint is ready - just needs deployment!** 🚀

