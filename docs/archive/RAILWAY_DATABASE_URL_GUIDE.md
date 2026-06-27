# 🔗 Railway Database URLs - Internal vs Public

## ✅ Use Internal/Private URLs (Recommended)

For services **within the same Railway project**, always use **internal/private URLs**.

### Why Internal URLs?
- ✅ **Faster** - Direct connection within Railway network
- ✅ **More secure** - Not exposed to the internet
- ✅ **Free** - No connection limits
- ✅ **Better performance** - Lower latency

---

## 📍 How to Find the Correct URLs

### For PostgreSQL:

1. Go to Railway dashboard
2. Click on **PostgreSQL** service
3. Go to **"Variables"** tab
4. Look for `DATABASE_URL`

**What you'll see:**
- Internal URL (use this): `postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway`
- Or: `postgresql://postgres:password@postgres.railway.internal:5432/railway`

**Use the one that appears in the Variables tab** - Railway automatically provides the correct one for internal connections.

### For Redis:

1. Go to Railway dashboard
2. Click on **Redis** service
3. Go to **"Variables"** tab
4. Look for `REDIS_URL`

**What you'll see:**
- Internal URL (use this): `redis://default:password@containers-us-west-xxx.railway.app:6379`
- Or: `redis://default:password@redis.railway.internal:6379`

**Use the one that appears in the Variables tab** - Railway automatically provides the correct one for internal connections.

---

## 🎯 Quick Answer

**Just copy the `DATABASE_URL` and `REDIS_URL` values directly from the Variables tab of each service.**

Railway automatically provides the correct internal URL in the Variables tab. You don't need to choose - just copy what's there!

---

## 📋 Step-by-Step

1. **PostgreSQL Service:**
   - Click PostgreSQL → Variables tab
   - Find `DATABASE_URL`
   - **Copy the entire value** (it's long!)
   - Paste into backend API service variables

2. **Redis Service:**
   - Click Redis → Variables tab
   - Find `REDIS_URL`
   - **Copy the entire value**
   - Paste into backend API service variables

3. **That's it!** Railway handles the rest automatically.

---

## ⚠️ Important Notes

- **Don't modify the URLs** - Copy them exactly as shown
- **Use the full connection string** - Don't remove any parts
- **Railway provides the correct URL** - The one in Variables tab is the right one
- **Internal URLs work automatically** - No special configuration needed

---

## 🔍 How to Verify

After adding the URLs:
1. Check Deploy Logs
2. Look for successful database connection messages
3. If you see connection errors, verify you copied the entire URL correctly

---

**TL;DR: Just copy `DATABASE_URL` and `REDIS_URL` from the Variables tab of each database service. Railway provides the correct internal URL automatically!**

