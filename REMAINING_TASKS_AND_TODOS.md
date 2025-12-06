# Remaining Tasks & TODOs - Complete List

## ✅ Recently Completed

1. ✅ **Slugify Consolidation** - All 6 duplicate functions consolidated to use shared utils
2. ✅ **Unused Code Cleanup** - Removed empty directories, unused packages, and unused functions
3. ✅ **Finance Page Fixes** - Fixed TypeScript errors and runtime issues
4. ✅ **API Console Logs** - Removed debug console logs
5. ✅ **Favicon Configuration** - Fixed 404 error

---

## 🔴 High Priority - Code Quality & Configuration

### 1. **React Strict Mode** ⚠️ TEMPORARY FIX
**Location**: `apps/web/next.config.js`
**Issue**: `reactStrictMode: false` - Temporarily disabled due to excessive mounts
**Status**: Needs investigation and proper fix
**Action Required**:
- Investigate why login page has 8+ mounts
- Fix the root cause (likely useEffect dependencies or state management)
- Re-enable `reactStrictMode: true` for better React development experience

### 2. **ESLint Build Ignore** ⚠️ TEMPORARY
**Location**: `apps/web/next.config.js`
**Issue**: `ignoreDuringBuilds: true` - Allows builds with ESLint errors
**Status**: Should be fixed and re-enabled
**Action Required**:
- Fix all ESLint errors
- Re-enable ESLint during builds
- Ensure code quality standards

### 3. **TypeScript Build Errors** ⚠️ CHECK
**Location**: `apps/web/next.config.js`
**Issue**: `ignoreBuildErrors: false` - Currently not ignoring, but should verify
**Status**: Verify no TypeScript errors exist
**Action Required**:
- Run `pnpm type-check` to verify
- Fix any TypeScript errors found

---

## 🟡 Medium Priority - Feature Placeholders

### 4. **"Coming Soon" Features** 📝
**Locations**:
- `apps/web/src/app/admin/finance/page.tsx` - Revenue reports (line 236)
- `apps/web/src/app/products/page.tsx` - Products page (line 16)
- `apps/web/src/app/sellers/page.tsx` - Sellers directory (line 15)
- `apps/web/src/app/fandoms/[slug]/page.tsx` - Fandom products (line 96)
- `apps/web/src/app/payment/page.tsx` - Payment integration (line 121)

**Action Required**:
- Implement actual functionality or remove placeholder pages
- Add proper loading states and error handling
- Connect to backend APIs

### 5. **Placeholder Data** 📝
**Locations**:
- `apps/web/src/components/FandomCollection.tsx` - Hardcoded fandom list (lines 7-12)
- `apps/web/src/app/admin/categories/page.tsx` - Placeholder comment (line 21)
- `apps/web/src/app/admin/reviews/page.tsx` - Placeholder comment (line 21)
- `apps/web/src/app/admin/seller-analytics/page.tsx` - Placeholder comment (line 22)
- `apps/web/src/app/admin/seller-applications/page.tsx` - Placeholder data (line 22)

**Action Required**:
- Replace with actual API calls
- Implement proper data fetching
- Add loading and error states

### 6. **Placeholder Images** 📝
**Locations**:
- `apps/web/src/components/HeroBanner.tsx` - SVG placeholders (lines 54, 64, 74)
- `apps/web/src/app/page.tsx` - Banner placeholders (lines 27, 34, 41, 48)
- `apps/web/src/app/page.tsx` - Featured placeholders (lines 90, 99)

**Action Required**:
- Replace SVG placeholders with actual JPG images
- Follow image specifications in `IMAGE_SPECIFICATIONS.md`
- Optimize images for web

---

## 🟢 Low Priority - Integrations & Configuration

### 7. **Third-Party Integrations** 🔌
**Status**: See `PENDING_INTEGRATIONS.md` for full list

**High Priority Integrations**:
- **Cloudinary** - Image/file storage (code exists, needs env vars)
- **Stripe** - Payment processing (code exists, needs configuration)
- **WhatsApp Business API** - Messaging (code exists, needs API keys)
- **Gemini AI** - Chatbot (code exists, needs API key)

**Action Required**:
- Add environment variables to Railway
- Test integrations
- Configure webhooks where needed

### 8. **Environment Variables** 🔐
**Missing Variables** (from `NEXT_STEPS_AND_TODOS.md`):
- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Elasticsearch: `ELASTICSEARCH_NODE`, `ELASTICSEARCH_USERNAME`, `ELASTICSEARCH_PASSWORD`
- Gemini: `GEMINI_API_KEY`
- WhatsApp: `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_ACCESS_TOKEN`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

**Action Required**:
- Add all required environment variables to Railway
- Verify connections work
- Test each integration

---

## 📋 Optional - Documentation & Cleanup

### 9. **Documentation Files** 📄
**Status**: Multiple historical documentation files exist

**Files to Consider Archiving**:
- `LINT_AND_ERROR_FIXES.md`
- `PHASE2_*.md` (multiple files)
- `PHASE6_*.md` (multiple files)
- `IMPLEMENTATION_SUMMARY*.md` (multiple files)
- `TEST_SUMMARY.md`
- `ALL_PHASES_COMPLETE.md`
- `NEXT_STEPS_*.md` (multiple files)

**Action Required**:
- Review and consolidate important information
- Archive or move to `docs/archive/` folder
- Keep only current/active documentation

### 10. **Placeholder Scripts** 🛠️
**Location**: `apps/web/scripts/`
- `generate-placeholders.js`
- `generate-placeholders.sh`

**Status**: Keep for development use (useful utilities)

---

## 🔍 Code Quality Items

### 11. **TODO/FIXME Comments** 📝
**Found in**: 55+ files in `services/api/src` and 11+ files in `apps/web/src`

**Action Required**:
- Review all TODO/FIXME comments
- Prioritize and address critical ones
- Remove resolved TODOs
- Document future improvements

### 12. **Console Error Handling** 🐛
**Status**: Many files use `console.error` for error logging

**Action Required**:
- Consider implementing proper error logging service
- Use structured logging (e.g., Winston, Pino)
- Remove unnecessary console.error calls
- Add proper error tracking (e.g., Sentry)

---

## 📊 Summary by Priority

### 🔴 Critical (Do First)
1. Fix React Strict Mode issue
2. Re-enable ESLint during builds
3. Verify TypeScript errors

### 🟡 Important (Do Soon)
4. Implement "coming soon" features
5. Replace placeholder data with API calls
6. Replace placeholder images

### 🟢 Nice to Have (Do Later)
7. Complete third-party integrations
8. Add missing environment variables
9. Archive old documentation
10. Review and address TODOs

---

## ✅ Verification Checklist

- [ ] React Strict Mode re-enabled
- [ ] ESLint errors fixed and builds enabled
- [ ] TypeScript errors resolved
- [ ] All "coming soon" features implemented or removed
- [ ] Placeholder data replaced with API calls
- [ ] Placeholder images replaced with actual images
- [ ] All environment variables added to Railway
- [ ] All integrations tested and working
- [ ] Documentation archived/cleaned
- [ ] TODOs reviewed and prioritized

---

## 📝 Notes

- Most critical items are temporary fixes that need proper solutions
- Placeholder features should be implemented or removed to avoid confusion
- Integrations are ready but need configuration
- Documentation cleanup is optional but recommended for maintainability

---

**Last Updated**: After slugify consolidation and code cleanup
**Status**: Ready for next phase of development

