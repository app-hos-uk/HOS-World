# 🔐 GitHub Authentication Guide for Cursor

## Overview

To push changes to `https://github.com/app-hos-uk/HOS-World`, you need:
1. **Write access** to the repository (from owner)
2. **Git authentication** configured in Cursor/terminal

---

## Step 1: Get Repository Write Access

### Option A: Request Access from Owner

**Repository Owner**: `app@houseofspells.co.uk`

**Steps**:
1. Contact the repository owner at `app@houseofspells.co.uk`
2. Request to be added as a **collaborator** with **write access**
3. Provide your GitHub username: `Sabuanchuparayil`
4. Once added, you'll receive an email invitation

**OR** if you have access to the organization:
1. Go to: https://github.com/app-hos-uk/HOS-World
2. Click **Settings** → **Collaborators**
3. Add your GitHub account with write permissions

---

## Step 2: Configure Git Authentication

### Method 1: Personal Access Token (Recommended)

#### Step 2.1: Create Personal Access Token

1. **Go to GitHub Settings**:
   - Visit: https://github.com/settings/tokens
   - Or: GitHub → Your Profile → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. **Generate New Token**:
   - Click **"Generate new token"** → **"Generate new token (classic)"**
   - **Note**: Give it a name (e.g., "HOS-World-Cursor")
   - **Expiration**: Choose duration (90 days, 1 year, or no expiration)
   - **Scopes**: Select these permissions:
     - ✅ `repo` (Full control of private repositories)
       - This includes: `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`, `security_events`
     - ✅ `workflow` (if you need GitHub Actions)

3. **Generate and Copy Token**:
   - Click **"Generate token"**
   - **⚠️ IMPORTANT**: Copy the token immediately (you won't see it again!)
   - Example: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

#### Step 2.2: Configure Git to Use Token

**Option A: Use Token in Remote URL (Temporary)**

```bash
cd HOS-World

# Set remote with token
git remote set-url origin https://<YOUR_TOKEN>@github.com/app-hos-uk/HOS-World.git

# Test push
git push origin master
```

**Option B: Use Git Credential Helper (Permanent - Recommended)**

```bash
cd HOS-World

# Configure credential helper to store token
git config --global credential.helper store

# When you push, git will prompt for credentials:
# Username: Sabuanchuparayil (or your GitHub username)
# Password: <paste your token here>

# First push will save credentials
git push origin master
```

**Option C: Use GitHub CLI (Easiest)**

```bash
# Install GitHub CLI if not installed
brew install gh  # macOS
# OR
# Download from: https://cli.github.com/

# Authenticate
gh auth login

# Follow prompts:
# - GitHub.com
# - HTTPS
# - Authenticate Git with your GitHub credentials? Yes
# - Login with a web browser? Yes (or use token)

# Verify
gh auth status
```

---

### Method 2: SSH Authentication (Alternative)

#### Step 2.1: Generate SSH Key

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "mail@jsabu.com"

# Press Enter to accept default location (~/.ssh/id_ed25519)
# Enter passphrase (optional but recommended)

# Start SSH agent
eval "$(ssh-agent -s)"

# Add SSH key to agent
ssh-add ~/.ssh/id_ed25519
```

#### Step 2.2: Add SSH Key to GitHub

1. **Copy Public Key**:
   ```bash
   cat ~/.ssh/id_ed25519.pub
   # Copy the entire output
   ```

2. **Add to GitHub**:
   - Go to: https://github.com/settings/keys
   - Click **"New SSH key"**
   - **Title**: "HOS-World Cursor" (or any name)
   - **Key**: Paste your public key
   - Click **"Add SSH key"**

#### Step 2.3: Configure Git to Use SSH

```bash
cd HOS-World

# Change remote to SSH
git remote set-url origin git@github.com:app-hos-uk/HOS-World.git

# Test connection
ssh -T git@github.com
# Should see: "Hi Sabuanchuparayil! You've successfully authenticated..."

# Test push
git push origin master
```

---

## Step 3: Configure Cursor to Use Git

### Option A: Cursor Uses System Git

Cursor uses your system's git configuration. Once you configure git (above), Cursor will use it automatically.

**Verify in Cursor**:
1. Open Cursor
2. Open Terminal (View → Terminal)
3. Run: `git config --list`
4. Check that your credentials are configured

### Option B: Cursor Git Settings

1. **Open Cursor Settings**:
   - `Cmd+,` (Mac) or `Ctrl+,` (Windows/Linux)
   - Search for "git"

2. **Configure Git Path** (if needed):
   - `git.path`: Should point to your git executable
   - Usually auto-detected

3. **Enable Git**:
   - Ensure `git.enabled` is `true`
   - `git.autofetch` can be enabled for auto-sync

---

## Step 4: Test Authentication

### Test Git Connection

```bash
cd HOS-World

# Check remote
git remote -v
# Should show: https://github.com/app-hos-uk/HOS-World.git

# Test authentication (if using token)
git ls-remote origin
# Should list branches without errors

# Test push (dry run)
git push --dry-run origin master
```

### Test Push (Small Change)

```bash
cd HOS-World

# Make a small test change
echo "# Test" >> TEST.md
git add TEST.md
git commit -m "test: Authentication test"

# Push
git push origin master

# If successful, delete test file
git rm TEST.md
git commit -m "test: Remove test file"
git push origin master
```

---

## Step 5: Troubleshooting

### Issue: "Permission denied (publickey)"

**Solution**: Use Personal Access Token instead of SSH, or ensure SSH key is added to GitHub.

### Issue: "remote: Permission to app-hos-uk/HOS-World.git denied"

**Solution**: 
1. Verify you have write access (contact owner)
2. Check you're using the correct GitHub account
3. Verify token has `repo` scope

### Issue: "fatal: could not read Username"

**Solution**: Configure credential helper:
```bash
git config --global credential.helper store
# Then push again and enter credentials when prompted
```

### Issue: Token Not Working

**Solution**:
1. Verify token hasn't expired
2. Check token has `repo` scope
3. Regenerate token if needed

---

## Step 6: Verify Access

### Check Repository Access

1. **GitHub Website**:
   - Go to: https://github.com/app-hos-uk/HOS-World
   - Check if you can see **Settings** tab (indicates write access)
   - Or check if you can create issues/PRs

2. **Git Command**:
   ```bash
   # Should work without errors
   git ls-remote --heads origin
   ```

---

## Quick Setup Script

Save this as `setup-git-auth.sh`:

```bash
#!/bin/bash

echo "🔐 GitHub Authentication Setup"
echo "=============================="
echo ""

cd HOS-World

# Check current remote
echo "Current remote:"
git remote -v
echo ""

# Prompt for method
echo "Choose authentication method:"
echo "1. Personal Access Token (Recommended)"
echo "2. SSH Key"
read -p "Enter choice (1 or 2): " choice

if [ "$choice" == "1" ]; then
    echo ""
    echo "📝 Steps:"
    echo "1. Create token at: https://github.com/settings/tokens"
    echo "2. Select 'repo' scope"
    echo "3. Copy the token"
    echo ""
    read -p "Enter your GitHub username: " username
    read -p "Enter your Personal Access Token: " token
    
    # Set remote with token
    git remote set-url origin https://${token}@github.com/app-hos-uk/HOS-World.git
    
    # Configure credential helper
    git config --global credential.helper store
    
    echo ""
    echo "✅ Configured! Testing connection..."
    git ls-remote origin
    
elif [ "$choice" == "2" ]; then
    echo ""
    echo "📝 Steps:"
    echo "1. Generate SSH key (if not exists)"
    echo "2. Add public key to GitHub"
    echo ""
    
    # Check if SSH key exists
    if [ ! -f ~/.ssh/id_ed25519.pub ]; then
        echo "Generating SSH key..."
        ssh-keygen -t ed25519 -C "mail@jsabu.com"
    fi
    
    echo "Your public key:"
    cat ~/.ssh/id_ed25519.pub
    echo ""
    echo "Add this key to: https://github.com/settings/keys"
    read -p "Press Enter after adding key to GitHub..."
    
    # Change to SSH
    git remote set-url origin git@github.com:app-hos-uk/HOS-World.git
    
    echo ""
    echo "✅ Configured! Testing connection..."
    ssh -T git@github.com
fi

echo ""
echo "✅ Setup complete!"
echo "Try: git push origin master"
```

---

## Summary

### Quick Checklist:

- [ ] Get write access from repository owner (`app@houseofspells.co.uk`)
- [ ] Create Personal Access Token (or SSH key)
- [ ] Configure git credentials
- [ ] Test connection
- [ ] Push your 3 commits

### Recommended Method:

1. **Get Access** → Contact owner
2. **Use Personal Access Token** → Easiest and most reliable
3. **Configure Credential Helper** → Saves token securely
4. **Test Push** → Verify everything works

---

## Next Steps After Authentication

Once authenticated:

```bash
cd HOS-World

# Push your 3 commits
git push origin master

# Verify on GitHub
# Go to: https://github.com/app-hos-uk/HOS-World/commits/master
```

---

**Need Help?** Contact repository owner or check GitHub documentation: https://docs.github.com/en/authentication


