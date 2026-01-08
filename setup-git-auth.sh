#!/bin/bash

# Script to help set up Git authentication for GitHub

echo "=========================================="
echo "GitHub Authentication Setup"
echo "=========================================="
echo ""

echo "Current remote URL:"
git remote -v
echo ""

echo "Checking for SSH keys..."
if [ -f ~/.ssh/id_rsa.pub ] || [ -f ~/.ssh/id_ed25519.pub ]; then
    echo "✅ SSH keys found!"
    echo ""
    echo "Option 1: Switch to SSH (Recommended if you have SSH keys)"
    echo "  Run: git remote set-url origin git@github.com:app-hos-uk/HOS-World.git"
    echo ""
else
    echo "⚠️  No SSH keys found"
    echo ""
    echo "To set up SSH:"
    echo "  1. Generate SSH key: ssh-keygen -t ed25519 -C 'app@houseofspells.co.uk'"
    echo "  2. Add to GitHub: https://github.com/settings/keys"
    echo "  3. Switch remote: git remote set-url origin git@github.com:app-hos-uk/HOS-World.git"
    echo ""
fi

echo "Option 2: Use Personal Access Token (Easier)"
echo "  1. Create token: https://github.com/settings/tokens"
echo "  2. Use token as password when pushing"
echo ""

echo "=========================================="
echo "Quick Fix: Switch to SSH"
echo "=========================================="
read -p "Do you want to switch to SSH now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git remote set-url origin git@github.com:app-hos-uk/HOS-World.git
    echo "✅ Remote URL changed to SSH"
    echo ""
    echo "Now try: git push origin master"
else
    echo ""
    echo "To use Personal Access Token:"
    echo "  1. Create token at: https://github.com/settings/tokens"
    echo "  2. Run: git push origin master"
    echo "  3. Username: app@houseofspells.co.uk"
    echo "  4. Password: (paste your token)"
fi
