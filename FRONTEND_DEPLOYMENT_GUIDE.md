# Frontend Deployment Guide for Railway

## 🚀 Quick Start

Deploy your Next.js frontend to Railway in just a few steps!

## Prerequisites

- ✅ Backend API deployed and accessible
- ✅ Railway account with project created
- ✅ GitHub repository connected

## Step-by-Step Deployment

### 1. Create New Service in Railway

1. Go to your Railway project dashboard
2. Click **"New"** → **"GitHub Repo"**
3. Select your repository: `app-hos-uk/HOS-World`
4. Railway will detect it's a monorepo

### 2. Configure Service Settings

In the service settings, configure:

**Basic Settings:**
- **Service Name:** `@hos-marketplace/web` (or `hos-marketplace-frontend`)
- **Root Directory:** `apps/web`
- **Dockerfile Path:** `apps/web/Dockerfile`

**Build Settings:**
- **Build Command:** (Leave empty - Dockerfile handles this)
- **Start Command:** (Leave empty - Dockerfile handles this)

**Deploy Settings:**
- **Health Check Path:** `/` (or disable it)
- **Health Check Timeout:** 300 seconds
- **Restart Policy:** ON_FAILURE
- **Max Retries:** 10

### 3. Set Environment Variables

Go to **Variables** tab and add:

**Required:**
```bash
NEXT_PUBLIC_API_URL=https://hos-marketplaceapi-production.up.railway.app/api
NODE_ENV=production
PORT=3000
```

**Optional (if needed):**
```bash
NEXT_PUBLIC_APP_URL=https://your-frontend.railway.app
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=your_stripe_key
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
# Add other public environment variables as needed
```

**Important Notes:**
- All `NEXT_PUBLIC_*` variables are exposed to the browser
- Never put secrets in `NEXT_PUBLIC_*` variables
- The API URL should point to your deployed backend

### 4. Deploy

1. Railway will automatically detect the Dockerfile
2. Click **"Deploy"** or wait for auto-deployment
3. Monitor the build logs

### 5. Verify Deployment

After deployment completes:

1. **Check Build Logs:**
   - ✅ `Build completed successfully`
   - ✅ `Compiled successfully`
   - ✅ No build errors

2. **Check Runtime Logs:**
   - ✅ `Ready on http://0.0.0.0:3000`
   - ✅ No startup errors

3. **Test the Frontend:**
   - Visit your Railway-generated URL (e.g., `https://hos-marketplace-web-production.up.railway.app`)
   - Verify the homepage loads
   - Check browser console for errors
   - Test API connectivity

## 🔧 Troubleshooting

### Build Fails

**Error: "Cannot find module"**
- Check if all packages are properly copied in Dockerfile
- Verify `pnpm-workspace.yaml` is included
- Check build logs for missing dependencies

**Error: "TypeScript errors"**
- Check if shared packages are built
- Verify `transpilePackages` in `next.config.js`
- Review type-check errors in logs

### Runtime Errors

**Error: "Cannot connect to API"**
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check CORS settings on backend
- Verify backend is accessible from frontend URL

**Error: "Port already in use"**
- Railway sets PORT automatically - don't override it
- Check if PORT environment variable conflicts

**Error: "Module not found"**
- Verify all workspace packages are installed
- Check if production dependencies include all packages
- Review Dockerfile COPY commands

### Performance Issues

**Slow Build Times:**
- Enable Railway build cache
- Optimize Dockerfile layer caching
- Consider using `.dockerignore`

**Large Image Size:**
- Use multi-stage builds (already implemented)
- Remove dev dependencies in production stage
- Optimize Next.js build output

## 📋 Verification Checklist

After deployment, verify:

- [ ] Frontend loads without errors
- [ ] Homepage displays correctly
- [ ] API calls work (check browser Network tab)
- [ ] Images load properly
- [ ] Navigation works
- [ ] No console errors
- [ ] Environment variables are set correctly
- [ ] Health check passes (if enabled)

## 🔗 Connecting Frontend to Backend

### Update CORS on Backend

In your Railway backend service, add/update:

```bash
FRONTEND_URL=https://your-frontend.railway.app
```

This allows the frontend to make API requests.

### Test API Connection

1. Open browser DevTools → Network tab
2. Navigate your frontend
3. Check for API calls to your backend
4. Verify responses are successful (200 status)

## 📝 Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `https://hos-marketplaceapi-production.up.railway.app/api` |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port (Railway sets this) | `3000` |

### Optional Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | Frontend URL | `https://your-frontend.railway.app` |
| `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` | Stripe public key | `pk_live_...` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID | `...` |

## 🎯 Next Steps After Deployment

1. **Set Up Custom Domain** (optional):
   - Go to service settings
   - Add custom domain
   - Configure DNS records

2. **Enable HTTPS:**
   - Railway provides HTTPS automatically
   - Custom domains need SSL configuration

3. **Monitor Performance:**
   - Check Railway metrics
   - Monitor error rates
   - Review response times

4. **Set Up Monitoring:**
   - Configure error tracking (Sentry, etc.)
   - Set up uptime monitoring
   - Configure alerts

## 🚨 Common Issues & Solutions

### Issue: Frontend can't connect to API

**Solution:**
1. Verify `NEXT_PUBLIC_API_URL` is correct
2. Check backend CORS settings include frontend URL
3. Verify backend is running and accessible
4. Check browser console for CORS errors

### Issue: Images not loading

**Solution:**
1. Check `next.config.js` image domains
2. Verify image paths are correct
3. Check if images are in `public` folder
4. Review Next.js image optimization settings

### Issue: Build takes too long

**Solution:**
1. Enable Railway build cache
2. Optimize Dockerfile layers
3. Use `.dockerignore` to exclude unnecessary files
4. Consider using Railway's build optimization

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

## ✅ Success Criteria

Your frontend deployment is successful when:

- ✅ Build completes without errors
- ✅ Service starts and stays running
- ✅ Frontend loads in browser
- ✅ API calls work correctly
- ✅ No console errors
- ✅ Images and assets load properly
- ✅ Navigation works smoothly

---

**Need Help?** Check Railway logs or review the troubleshooting section above.

