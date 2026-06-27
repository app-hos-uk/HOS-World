# 🔧 Fix bcrypt Native Module Error

## Problem
The bcrypt native module needs to be rebuilt for your Node.js version (v24.3.0).

## Solution

Run these commands in your **local terminal** (not in Cursor):

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"
pnpm rebuild bcrypt
```

If that doesn't work, try:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm rebuild bcrypt
```

Or force reinstall bcrypt:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"
pnpm remove bcrypt
pnpm add bcrypt
```

## Alternative: Rebuild All Native Modules

If you have other native modules that might have issues:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"
pnpm rebuild
```

## After Rebuilding

Once bcrypt is rebuilt, try running the application again:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm dev
```

## Why This Happens

bcrypt is a native Node.js module that needs to be compiled for your specific:
- Node.js version (v24.3.0)
- Operating system (macOS)
- Architecture (likely arm64 for Apple Silicon or x64 for Intel)

When you install dependencies, sometimes the native modules aren't built correctly, especially in monorepos with pnpm.
