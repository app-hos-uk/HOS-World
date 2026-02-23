# Endpoints & Navigation Audit

**Date:** 2025-02-19

## Summary

Review of all API endpoints, api-client methods, app routes, and navigation to identify missing pages and broken links.

---

## 1. Missing Navigation Links (Admin) – FIXED

| Page Exists | Route | Fix Applied |
|-------------|-------|-------------|
| ✅ | `/admin/settlements` | Added "Settlements" under Finance in AdminLayout. |
| ✅ | `/admin/reports` | Added "All Reports" linking to /admin/reports. |
| ✅ | `/admin/reports/inventory` | Added "Inventory Reports" to Analytics & Reports sidebar. |

---

## 2. Broken Links (404) – FIXED

| Link | Source | Fix Applied |
|------|--------|-------------|
| `/cms/pages/[id]/edit` | `cms/pages/page.tsx` – "Edit" button | Changed to `/cms/pages?edit=id` with in-page edit form. |

---

## 3. Missing Pages (API exists, no UI)

| API / Feature | Endpoint | Status |
|---------------|----------|--------|
| **Publishing Dashboard** | `GET /publishing/ready`, `POST /publishing/publish/:id`, `POST /publishing/bulk-publish` | No dedicated page. Publishing is done from admin/submissions. A `/admin/publishing` or `/publishing/dashboard` could list FINANCE_APPROVED items ready to publish. |
| **Webhooks** | `GET/POST/PUT/DELETE /webhooks` | No admin UI for webhook management. |
| **Customer Support Tickets** | `POST /support/tickets` (createTicket) | No customer-facing page. Help page has static contact info only. Customers cannot create tickets from the app. |

---

## 4. Navigation Structure Verified

- **AdminLayout** – All menu items have corresponding pages except Settlements, Reports hub, Inventory report (see above).
- **Header** – Role quick links and dashboard links verified.
- **Footer** – /products, /fandoms, /sellers, /help, /shipping, /returns all exist.
- **CMS** – dashboard, pages, blog, banners, media, settings all exist.

---

## 5. Recommendations

### High Priority
1. **Add Settlements to Admin nav** – Under Finance: `{ title: 'Settlements', href: '/admin/settlements', icon: '💸' }`
2. **Add Inventory Reports to sidebar** – Under Analytics & Reports
3. **Fix CMS Edit link** – Create `cms/pages/[id]/edit` page or use `/cms/pages?edit=id`

### Medium Priority
4. **Customer Support Ticket creation** – Add "Submit a ticket" to /help or create /support/new
5. **Reports hub link** – Add "All Reports" or "Reports" parent linking to /admin/reports

### Low Priority
6. **Publishing Dashboard** – Optional dedicated page for FINANCE_APPROVED items
7. **Webhooks admin UI** – For advanced integrations
