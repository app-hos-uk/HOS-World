# Security Update - Next.js 14.2.35

## Issue
Railway deployment was blocked due to security vulnerabilities in Next.js 14.2.33:
- **CVE-2025-55184** (HIGH severity)
- **CVE-2025-67779** (HIGH severity)

## Fix Applied
Updated Next.js from `^14.0.4` to `^14.2.35` in `apps/web/package.json`

## Changes Made
- Updated `next` dependency: `^14.0.4` → `^14.2.35`
- Updated `eslint-config-next` dev dependency: `^14.0.4` → `^14.2.35`

## Deployment
- Changes committed and pushed to `master` branch
- Railway will automatically:
  1. Detect the updated package.json
  2. Run `pnpm install` to update dependencies
  3. Verify no security vulnerabilities
  4. Proceed with deployment

## Verification
After deployment, verify:
- [ ] Railway deployment completes successfully
- [ ] No security vulnerability warnings
- [ ] Application runs correctly with Next.js 14.2.35

## References
- CVE-2025-55184: https://github.com/vercel/next.js/security/advisories/GHSA-mwv6-3258-q52c
- CVE-2025-67779: https://github.com/vercel/next.js/security/advisories/GHSA-5j59-xgg2-r9c4

