# ⚡ Quick GitHub Authentication Setup

## Current Status
- ✅ Git configured: `Sabu J <mail@jsabu.com>`
- ✅ Credential helper: macOS Keychain
- ✅ Remote: https://github.com/app-hos-uk/HOS-World.git
- ⚠️ Need: Write access + authentication

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Get Repository Access

**Contact**: `app@houseofspells.co.uk`
- Request write access to `app-hos-uk/HOS-World`
- Provide your GitHub username: `Sabuanchuparayil`

**OR** if you have organization access:
- Go to: https://github.com/app-hos-uk/HOS-World/settings/access
- Add yourself as collaborator

---

### Step 2: Create Personal Access Token

1. **Go to**: https://github.com/settings/tokens
2. **Click**: "Generate new token" → "Generate new token (classic)"
3. **Name**: `HOS-World-Cursor`
4. **Expiration**: Choose (90 days recommended)
5. **Scopes**: ✅ Check `repo` (Full control of private repositories)
6. **Click**: "Generate token"
7. **⚠️ COPY TOKEN IMMEDIATELY** (you won't see it again!)

---

### Step 3: Configure Git (Choose One Method)

#### Method A: Use Token Directly (Quick Test)

```bash
cd HOS-World

# Replace <YOUR_TOKEN> with actual token
git remote set-url origin https://<YOUR_TOKEN>@github.com/app-hos-uk/HOS-World.git

# Test push
git push origin master
```

#### Method B: Use macOS Keychain (Recommended - Permanent)

```bash
cd HOS-World

# When you push, macOS will prompt for credentials
# Username: Sabuanchuparayil
# Password: <paste your token here>

# First push will save to keychain
git push origin master
```

**macOS will save credentials in Keychain Access automatically!**

---

### Step 4: Test Authentication

```bash
cd HOS-World

# Test connection
git ls-remote origin

# Should show branches without errors
# If you see branches, authentication works!
```

---

## ✅ Verify It Works

```bash
cd HOS-World

# Push your 3 commits
git push origin master

# Check on GitHub
# Go to: https://github.com/app-hos-uk/HOS-World/commits/master
# You should see your commits!
```

---

## 🔧 Alternative: SSH Authentication

If you prefer SSH:

```bash
# 1. Generate SSH key (if not exists)
ssh-keygen -t ed25519 -C "mail@jsabu.com"

# 2. Copy public key
cat ~/.ssh/id_ed25519.pub

# 3. Add to GitHub: https://github.com/settings/keys
#    Click "New SSH key", paste public key

# 4. Change remote to SSH
git remote set-url origin git@github.com:app-hos-uk/HOS-World.git

# 5. Test
ssh -T git@github.com
git push origin master
```

---

## 🆘 Troubleshooting

### "Permission denied"
- ✅ Verify you have write access (contact owner)
- ✅ Check token has `repo` scope
- ✅ Verify you're using correct GitHub account

### "Authentication failed"
- ✅ Regenerate token
- ✅ Check token hasn't expired
- ✅ Try SSH method instead

### "Could not read Username"
- ✅ macOS Keychain should handle this automatically
- ✅ Or use token in remote URL (Method A)

---

## 📝 Summary

**Fastest Method**:
1. Get access from owner
2. Create Personal Access Token
3. Use Method B (macOS Keychain) - just push, enter token when prompted
4. Done! ✅

**Your 3 commits will push successfully!**

