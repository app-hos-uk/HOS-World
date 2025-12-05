# 🚀 Create Team Users via API Endpoint

## ✅ Solution: API Endpoint Created!

I've created an API endpoint that will create all team role users directly via the API.

---

## 🎯 Method: Use API Endpoint (Easiest!)

### Step 1: Call the API Endpoint

**After the backend is deployed**, call this endpoint:

```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/admin/create-team-users \
  -H "Content-Type: application/json"
```

### Step 2: Verify Users Created

Check the response - it will show which users were created/updated:

```json
{
  "data": {
    "users": [
      { "email": "admin@hos.test", "status": "created", "role": "ADMIN" },
      ...
    ],
    "totalCreated": 7,
    "totalUpdated": 0
  },
  "message": "Team users creation completed"
}
```

---

## 🔒 Security Note

**⚠️ Important:** The endpoint is temporarily **unprotected** for setup purposes. After creating users:

1. **Remove or protect the endpoint** by uncommenting the auth guards in:
   `services/api/src/admin/create-team-users.controller.ts`

2. **Or** keep it protected and use the admin user to call it:
   ```bash
   # Login first to get token
   TOKEN=$(curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "app@houseofspells.co.uk", "password": "Admin123"}' \
     | jq -r '.data.token')
   
   # Then create team users
   curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/admin/create-team-users \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN"
   ```

---

## 📋 Users That Will Be Created

| Email | Role | Password |
|-------|------|----------|
| admin@hos.test | ADMIN | Test123! |
| procurement@hos.test | PROCUREMENT | Test123! |
| fulfillment@hos.test | FULFILLMENT | Test123! |
| catalog@hos.test | CATALOG | Test123! |
| marketing@hos.test | MARKETING | Test123! |
| finance@hos.test | FINANCE | Test123! |
| cms@hos.test | CMS_EDITOR | Test123! |

---

## ✅ Quick Test

After deploying the backend, simply run:

```bash
curl -X POST https://hos-marketplaceapi-production.up.railway.app/api/admin/create-team-users \
  -H "Content-Type: application/json"
```

**That's it!** All 7 users will be created! 🎉

---

## 🔄 Alternative: Use Browser

You can also call it via browser automation once the backend is deployed!

