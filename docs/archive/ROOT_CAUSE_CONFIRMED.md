# Root Cause Confirmed - Runtime Evidence Analysis

## Key Evidence from Logs:

1. **Line 3-4**: Component first mounts on pathname **"/"** (home page)
   - mountId: `mount_1764943669996_n198vhh07`
   - pathname: "/"
   
2. **Line 5-7**: Pathname changes to "/login" (navigation occurs)
   - Same mountId, but pathname changes
   
3. **Lines 8-19**: **6 additional mounts** happen rapidly
   - All with NEW mountIds (new component instances)
   - All on "/login" pathname
   - Happening within ~40 seconds
   
4. **ThemeProviderWrapper remounts** 3 times (lines 1, 2, 20)

## Root Cause Identified:

**PRIMARY**: Next.js is rendering the login page component during SSR/hydration on the home route ("/"), then client-side navigates to "/login". This causes:
- Initial mount on wrong route
- Navigation triggers remount  
- React Strict Mode doubles renders (2x)
- Next.js RSC requests causing additional mounts
- ThemeProviderWrapper remounting triggering child remounts

**EVIDENCE**: 
- Component mounts on "/" first (line 3)
- Then pathname changes to "/login" (line 5-7)
- Multiple new component instances created (different mountIds)

## Solution Required:

1. **Prevent rendering on wrong route**: Early return if not on "/login"
2. **Use usePathname()**: Check route before rendering
3. **Memoize ThemeProviderWrapper**: Prevent unnecessary remounts
4. **Memoize context value**: Stabilize ThemeProvider context

