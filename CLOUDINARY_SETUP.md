# ☁️ Cloudinary Integration Setup

## ✅ Implementation Complete!

Cloudinary integration has been implemented and is ready to use.

---

## 🔑 Your Cloudinary Credentials

Based on the information you provided:

```env
CLOUDINARY_CLOUD_NAME=hosworld
CLOUDINARY_API_KEY=859298542795445
CLOUDINARY_API_SECRET=8mwlx2zlSyruKUfek_GnG7eeLmY
```

**Note:** If your API Key is different (e.g., `dd47789b2aa78d414ecccbd031f3c8`), please verify in your Cloudinary dashboard.

---

## 🚀 Add to Railway

### Step 1: Go to Railway Dashboard

1. Open Railway Dashboard: https://railway.app
2. Select your project
3. Click on `@hos-marketplace/api` service
4. Go to **Variables** tab

### Step 2: Add Environment Variables

Click **"New Variable"** and add each of these:

```env
CLOUDINARY_CLOUD_NAME=hosworld
CLOUDINARY_API_KEY=859298542795445
CLOUDINARY_API_SECRET=8mwlx2zlSyruKUfek_GnG7eeLmY
STORAGE_PROVIDER=cloudinary
```

### Step 3: Verify

After adding variables, Railway will automatically redeploy. Check the logs to see:
```
[StorageService] Cloudinary initialized successfully
```

---

## 📝 What Was Implemented

### ✅ Completed

1. **Cloudinary SDK Installed**
   - Package: `cloudinary@^2.8.0`
   - Added to `services/api/package.json`

2. **Storage Service Updated**
   - `uploadToCloudinary()` - Fully implemented
   - `deleteFromCloudinary()` - Fully implemented
   - Automatic initialization on service start
   - Error handling and logging

3. **Features**
   - Image upload with optimization
   - Automatic format conversion
   - Resize support
   - Secure URL generation
   - File deletion

---

## 🎯 How It Works

### Upload Flow

1. File is received via API endpoint
2. Storage service detects `STORAGE_PROVIDER=cloudinary`
3. File is converted to base64
4. Uploaded to Cloudinary with folder structure
5. Returns secure URL and public_id

### Delete Flow

1. URL is provided to delete endpoint
2. Service extracts public_id from URL
3. Calls Cloudinary API to delete
4. Logs result

---

## 📂 Folder Structure

Files will be organized in Cloudinary by folder:

- **Product Images:** `products/{productId}/`
- **User Avatars:** `users/{userId}/`
- **Seller Logos:** `sellers/{sellerId}/`
- **Theme Assets:** `themes/{themeId}/`
- **General Uploads:** `uploads/`

---

## 🧪 Testing

### Test Upload (After Deployment)

1. Make a POST request to your upload endpoint
2. Include file in form data
3. Check response for Cloudinary URL
4. Verify image appears in Cloudinary dashboard

### Verify in Cloudinary Dashboard

1. Go to: https://console.cloudinary.com
2. Login with your account
3. Go to **Media Library**
4. You should see uploaded files organized by folder

---

## 🔒 Security Notes

1. **API Secret is Sensitive**
   - Never commit to git
   - Only store in Railway environment variables
   - Don't share publicly

2. **URLs are Secure**
   - Cloudinary returns `secure_url` (HTTPS)
   - URLs are signed for private resources (if configured)

3. **Access Control**
   - Configure upload presets in Cloudinary dashboard
   - Set up transformations for different use cases

---

## 🎨 Image Transformations

Cloudinary supports automatic transformations. You can add these in the upload options:

```typescript
// Example: Resize and optimize
await storageService.uploadFile(file, 'products', {
  optimize: true,
  resize: { width: 800, height: 600 }
});
```

**Available Options:**
- `optimize: true` - Auto quality and format
- `resize: { width, height }` - Resize with aspect ratio
- Custom transformations via Cloudinary API

---

## 📊 Usage in Code

### Upload Single File

```typescript
const result = await storageService.uploadFile(file, 'products/product-123');
// Returns: { url: 'https://res.cloudinary.com/...', publicId: '...', provider: 'cloudinary' }
```

### Upload Multiple Files

```typescript
const results = await storageService.uploadMultipleFiles(files, 'products/product-123');
// Returns: Array of upload results
```

### Delete File

```typescript
await storageService.deleteFile('https://res.cloudinary.com/.../image.jpg');
```

---

## 🐛 Troubleshooting

### Issue: "Cloudinary credentials not configured"

**Solution:**
- Verify all 3 environment variables are set in Railway
- Check variable names are exact (case-sensitive)
- Redeploy after adding variables

### Issue: "Cloudinary upload failed"

**Solution:**
- Check API key and secret are correct
- Verify cloud name matches your account
- Check Cloudinary dashboard for API usage limits
- Review Railway logs for detailed error

### Issue: "File not deleting"

**Solution:**
- Verify URL format is correct
- Check public_id extraction
- Review Cloudinary dashboard for file status

---

## 📚 Resources

- **Cloudinary Dashboard:** https://console.cloudinary.com
- **Cloudinary Docs:** https://cloudinary.com/documentation
- **Node.js SDK:** https://cloudinary.com/documentation/node_integration

---

## ✅ Next Steps

1. ✅ Add credentials to Railway (see above)
2. ✅ Wait for automatic redeployment
3. ✅ Test file upload via API
4. ✅ Verify files appear in Cloudinary dashboard
5. ✅ Test file deletion

---

**Status:** ✅ Ready to use after Railway variables are added!

**Last Updated:** December 3, 2025

