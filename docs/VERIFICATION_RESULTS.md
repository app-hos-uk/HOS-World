# Database & API Verification

## Summary (Last Run)

- **Database tables:** ✅ All 97 expected tables present
- **API endpoints:** ✅ All 9 smoke-tested endpoints returning proper data

## Database Verification

### Tables

All Prisma schema tables exist in the production database:

- Core: users, products, orders, categories, etc.
- Auth: refresh_tokens, oauth_accounts
- Taxonomy: categories, attributes, tags
- Support: SupportTicket, TicketMessage, WhatsAppConversation, etc.
- And 80+ more

### Row Counts (Key Tables)

| Table     | Count |
|----------|-------|
| users    | 29    |
| products | 4     |
| orders   | 1     |
| categories | 27  |

## API Verification

### Smoke-Tested Endpoints

| Endpoint              | Status | Description                    |
|-----------------------|--------|--------------------------------|
| GET /                 | 200    | Root/health                    |
| GET /health           | 200    | Health check                   |
| GET /health/live      | 200    | Liveness probe                 |
| GET /health/ready     | 200    | Readiness (DB + Redis)         |
| GET /products         | 200    | Products list                  |
| GET /taxonomy/categories | 200 | Categories                     |
| GET /themes           | 200    | Themes                         |
| GET /fandoms          | 200    | Fandoms                        |
| GET /auth/me          | 401    | Current user (requires auth)   |

## How to Run Verification

### Database Tables

```bash
cd services/api
DATABASE_URL="postgresql://..." pnpm run verify:db-tables
```

Or with Railway public URL for production:

```bash
cd services/api
DATABASE_URL="<DATABASE_PUBLIC_URL>" pnpm run verify:db-tables
```

### API Endpoints

```bash
# Production (default)
API_BASE_URL="https://hos-marketplaceapi-production.up.railway.app/api" pnpm run verify:api

# Local
API_BASE_URL="http://localhost:3001/api" pnpm run verify:api
```
