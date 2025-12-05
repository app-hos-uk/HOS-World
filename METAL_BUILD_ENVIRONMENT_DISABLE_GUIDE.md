# 🔧 Guide: Disable Metal Build Environment

## Understanding the Modal

The modal shows:
- **Setting:** "Build Environm..." (truncated - likely "Build Environment")
- **Current Value:** "V3" (Metal Build Environment version)
- **New Value:** Empty (you're trying to clear it)
- **Warning:** "@hos-marketplace/web will redeploy"

---

## ✅ What to Do

### Option 1: Clear the Build Environment (Recommended)

**If "Build Environment" refers to Metal Build Environment:**

1. **Leave "New Value" empty** (as it currently is - red/empty field)
2. **Click "Deploy Changes"** button (purple button with checkmark)
3. **Wait 5-7 minutes** for deployment to complete
4. This will disable Metal Build Environment

**This should work if:**
- The setting controls Metal Build Environment
- Empty value means "use default/standard build environment"

---

### Option 2: Cancel and Find the Toggle

**If you're not sure this is the right setting:**

1. **Click the "X"** (close button) in the top right
2. **OR click outside the modal** to cancel
3. **Go back to Settings tab**
4. **Look for a toggle switch** labeled "Use Metal Build Environment"
5. **Toggle it OFF** (should be gray/left position)

---

## 🔍 How to Verify

### After Applying the Change:

1. **Go to:** Settings tab
2. **Find:** "Metal Build Environment" section
3. **Check:**
   - ✅ Toggle should be **OFF** (gray)
   - ✅ Or Build Environment field should be empty/blank

### After Deployment:

1. **Go to:** Deployments tab
2. **Check Build Logs** of the new deployment
3. **Look for:**
   - Should NOT see: "Metal builder" in logs
   - Should see: Standard build process

---

## 🎯 Recommended Action

**Based on the modal:**

1. **Confirm the "New Value" is empty** (it shows as red/empty - that's correct)
2. **Click "Deploy Changes"** (purple button)
3. **This will:**
   - Clear the Build Environment setting
   - Redeploy the service
   - Use standard build environment (not Metal)

---

## ⚠️ Important Notes

- **"@hos-marketplace/web will redeploy"** - This is expected! The service will redeploy after applying the change.
- **Empty "New Value"** - This means "no special build environment" = standard build (good!)
- **Current Value "V3"** - This is the Metal Build Environment version (we want to remove it)

---

## 📋 Step-by-Step

1. ✅ **Verify "New Value" is empty** (red field - currently empty)
2. ✅ **Click "Deploy Changes"** (purple button with checkmark)
3. ⏳ **Wait 5-7 minutes** for deployment
4. ✅ **Check Settings** - Metal Build Environment should be disabled
5. ✅ **Check Build Logs** - Should use standard build, not Metal

---

## Summary

**Action: Click "Deploy Changes" button**

This will:
- ✅ Clear the Build Environment setting (remove "V3")
- ✅ Disable Metal Build Environment
- ✅ Redeploy with standard build environment
- ✅ Should fix any build/cache issues

**The empty "New Value" is correct - click "Deploy Changes"!**

