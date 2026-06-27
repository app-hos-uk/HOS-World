# Debug Hypotheses: Login Page 8+ Component Mounts

## Problem
Login page component is mounting 8+ times, causing instability and preventing proper login functionality.

## Hypotheses

### Hypothesis A: React Strict Mode + Next.js RSC Navigation Loop
**Theory:** React Strict Mode causes double renders (2x), and Next.js RSC fetch requests (`login?_rsc=19zvn`) are triggering navigation events that cause additional remounts (4x multiplier = 8+ mounts)

**Evidence needed:**
- Count of Strict Mode double-invocations
- Count of RSC fetch requests
- Navigation events between mounts

### Hypothesis B: Router Navigation Loop
**Theory:** Something is causing a navigation loop between `/login` and `/` or other routes, causing the component to mount/unmount repeatedly

**Evidence needed:**
- Router navigation events
- Pathname changes between mounts
- Stack traces of navigation triggers

### Hypothesis C: Parent Component Remounting
**Theory:** Parent components (ThemeProviderWrapper, RootLayout) are remounting, causing child components to remount

**Evidence needed:**
- Parent component mount/unmount cycles
- Layout component render counts

### Hypothesis D: onUnauthorized Callback Loop
**Theory:** The `onUnauthorized` callback is being triggered incorrectly (perhaps by RSC requests returning 401), causing redirects that trigger remounts

**Evidence needed:**
- Count of `onUnauthorized` calls
- API response status codes
- Redirect events

### Hypothesis E: useEffect Dependency Loop
**Theory:** A useEffect has dependencies that cause state updates, triggering re-renders that lead to remounts

**Evidence needed:**
- useEffect execution counts
- State update sequences
- Dependency changes

### Hypothesis F: Next.js Development Hot Reload
**Theory:** Next.js hot module replacement or development mode is causing excessive remounts

**Evidence needed:**
- Production vs development behavior
- Hot reload events

