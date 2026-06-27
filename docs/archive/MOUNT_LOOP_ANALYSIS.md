# Mount Loop Analysis - Runtime Evidence

## Key Findings from Logs:

1. **Multiple Component Instances**: Each mount has a unique mountId, meaning new component instances
2. **Timeline**:
   - Line 31-37: Component mounts 8+ times rapidly
   - Line 38-40: ThemeProviderWrapper renders on "/" (home), then login mounts
   - Line 56: Redirect to home after login
   - Line 59-60: Home page mounts
   - Line 62-68: Login component mounts AGAIN after redirect!

3. **Pattern**: 
   - ThemeProviderWrapper remounts (lines 38, 40, 61, 80, 82)
   - Component mounts repeatedly
   - After redirect to home, login page mounts again

## Root Cause Hypotheses:

**Hypothesis L: ThemeProviderWrapper Remount Loop**
- ThemeProviderWrapper keeps remounting on different pathnames
- Each remount causes all children (including login page) to remount
- Evidence: ThemeProviderWrapper renders on "/" and "/login" repeatedly

**Hypothesis M: Post-Redirect Remount**
- After redirect to home, something triggers login page to mount again
- Could be navigation guard, auth check, or layout remount
- Evidence: Login mounts after home page mounts (lines 62-68)

**Hypothesis N: React Strict Mode + Fast Refresh**
- React Strict Mode (enabled in next.config.js) causes double renders
- Fast Refresh or HMR causing additional remounts
- Evidence: Multiple mounts happening rapidly

## Next Steps:
- Memoize ThemeProviderWrapper to prevent remounts
- Check what triggers login page mount after redirect
- Disable React Strict Mode temporarily to test

