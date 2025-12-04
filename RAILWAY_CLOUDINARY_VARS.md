# 🚀 Quick Guide: Add Cloudinary to Railway

## Step-by-Step Instructions

### 1. Open Railway Dashboard
- Go to: https://railway.app
- Login to your account
- Select your **HOS Marketplace** project

### 2. Navigate to API Service
- Click on **`@hos-marketplace/api`** service
- Click on **Variables** tab (left sidebar)

### 3. Add These 4 Variables

Click **"New Variable"** for each one:

#### Variable 1:
- **Key:** `CLOUDINARY_CLOUD_NAME`
- **Value:** `hosworld`
- Click **Add**

#### Variable 2:
- **Key:** `CLOUDINARY_API_KEY`
- **Value:** `859298542795445`
- Click **Add**

#### Variable 3:
- **Key:** `CLOUDINARY_API_SECRET`
- **Value:** `8mwlx2zlSyruKUfek_GnG7eeLmY`
- Click **Add**

#### Variable 4:
- **Key:** `STORAGE_PROVIDER`
- **Value:** `cloudinary`
- Click **Add**

### 4. Verify Variables

You should see all 4 variables in the list:
- ✅ `CLOUDINARY_CLOUD_NAME=hosworld`
- ✅ `CLOUDINARY_API_KEY=859298542795445`
- ✅ `CLOUDINARY_API_SECRET=8mwlx2zlSyruKUfek_GnG7eeLmY`
- ✅ `STORAGE_PROVIDER=cloudinary`

### 5. Wait for Redeployment

Railway will automatically:
- Detect the new variables
- Trigger a new deployment
- Restart the service

### 6. Check Logs

After deployment completes:
1. Go to **Deployments** tab
2. Click on the latest deployment
3. Check logs for:
   ```
   [StorageService] Cloudinary initialized successfully
   ```

If you see this message, Cloudinary is working! ✅

---

## 🎯 What Happens Next

Once variables are added:
- ✅ File uploads will go to Cloudinary
- ✅ Images will be optimized automatically
- ✅ Secure URLs will be generated
- ✅ Files will be organized by folder

---

## ⚠️ Important Notes

1. **API Secret is Sensitive**
   - Never share it publicly
   - Keep it secure in Railway

2. **Verify API Key**
   - If your API key is different (e.g., `dd47789b2aa78d414ecccbd031f3c8`), use that instead
   - Check your Cloudinary dashboard to confirm

3. **Case Sensitive**
   - Variable names must be exact (uppercase)
   - Values are case-sensitive for cloud name

---

## ✅ Done!

After adding variables and seeing the success log, Cloudinary is fully integrated!

See `CLOUDINARY_SETUP.md` for detailed documentation.

