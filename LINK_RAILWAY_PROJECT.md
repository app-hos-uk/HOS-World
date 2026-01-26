# Link Railway Project

## Quick Link Commands

Run these commands to link your Railway project:

### Option 1: Interactive Link
```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu/services/api"
railway link
```

This will:
1. Show a list of your Railway projects
2. Let you select the API project
3. Link the current directory to that project

### Option 2: Link by Project ID
If you know your project ID:
```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu/services/api"
railway link <project-id>
```

### Option 3: Link via Dashboard
1. Go to Railway Dashboard: https://railway.app/dashboard
2. Select your API project (`@hos-marketplace/api` or similar)
3. Go to Settings → General
4. Copy the Project ID
5. Run: `railway link <project-id>`

## After Linking

Once linked, run the diagnostic script again:
```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu"
bash check-railway-api.sh
```

## Find Your Project

If you're not sure which project to link:

1. **Check Railway Dashboard:**
   - Go to https://railway.app/dashboard
   - Look for a project named:
     - `hos-marketplace`
     - `@hos-marketplace/api`
     - `House of Spells API`
     - Or similar

2. **List all projects:**
   ```bash
   railway projects
   ```

3. **Check service name:**
   - The API service should be named `api` or `@hos-marketplace/api`
   - The URL is: `https://hos-marketplaceapi-production.up.railway.app`

## Verify Link

After linking, verify it worked:
```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu/services/api"
railway status
```

You should see service information, not "No linked project found".

## Next Steps

Once linked, you can:
- Check logs: `railway logs --tail`
- Check variables: `railway variables`
- Check status: `railway status`
- View deployments: Check Railway dashboard
