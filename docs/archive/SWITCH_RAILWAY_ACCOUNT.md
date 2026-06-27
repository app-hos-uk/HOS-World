# Switch Railway Account

## Quick Steps

### 1. Log Out of Current Account
```bash
railway logout
```

### 2. Log In with Different Account
```bash
railway login
```

This will:
- Open your browser
- Ask you to authorize the Railway CLI
- Log you in with the new account

### 3. Verify New Account
```bash
railway whoami
```

This shows which account you're logged in as.

### 4. Link Your Project
```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu/services/api"
railway link
```

Select your project from the list.

### 5. Check Status
```bash
railway status
railway logs --tail
```

## Automated Script

Or use the automated script:
```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu"
bash switch-railway-account.sh
```

## Manual Steps

If you prefer to do it manually:

```bash
# Step 1: Log out
railway logout

# Step 2: Log in (will open browser)
railway login

# Step 3: Verify account
railway whoami

# Step 4: Navigate to API directory
cd "/Users/sabuj/Desktop/HOS-latest Sabu/services/api"

# Step 5: Link project
railway link

# Step 6: Check status
railway status
railway variables
railway logs --tail 100
```

## Troubleshooting

### If `railway login` doesn't open browser:
1. Check if you have a default browser set
2. Or manually visit: https://railway.app/cli
3. Copy the token and paste it in the terminal

### If you can't see your projects:
1. Make sure you're logged into the correct account
2. Check: `railway whoami`
3. Verify the account has access to the project

### If linking fails:
1. Make sure you're in the correct directory: `services/api`
2. Check if the project exists in your account
3. Try: `railway link <project-id>` (get ID from dashboard)

## After Switching Accounts

Once logged in with the new account:

1. **Link the project:**
   ```bash
   cd "/Users/sabuj/Desktop/HOS-latest Sabu/services/api"
   railway link
   ```

2. **Check API status:**
   ```bash
   cd "/Users/sabuj/Desktop/HOS-latest Sabu"
   bash check-railway-api.sh
   ```

3. **View logs:**
   ```bash
   cd "/Users/sabuj/Desktop/HOS-latest Sabu/services/api"
   railway logs --tail 100
   ```

## What to Look For in Logs

After switching accounts and checking logs, look for:

**Good signs:**
- `✅ Server is listening on port 3001`
- `✅ API server is running on: http://0.0.0.0:3001/api`
- `✅ Pre-flight check PASSED - All models found`

**Bad signs (explains 404 errors):**
- `❌ RefreshToken model missing from PrismaClient`
- `Error: P1001: Can't reach database server`
- `TypeError: Cannot read properties`
