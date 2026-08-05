# Staging Deployment Checklist

## Pre-deployment

- [ ] Confirm staging database connection string is set in `DATABASE_URL`
- [ ] Confirm staging Redis is available (`REDIS_URL`)
- [ ] Back up the staging database before running migrations
- [ ] Verify no other deployment is in progress

## 1. Run Prisma Migration

```bash
cd services/api
DATABASE_URL="<staging-db-url>" npx prisma migrate deploy
```

The consolidated migration (`20261008120000_loyalty_pos_xero_schema_consolidation`) adds:
- `LoyaltyTransaction.idempotencyKey` with unique index
- `User.phoneNormalized` indexed column
- `POSConnection.lastSaleVersion` cursor field
- `LoyaltyPosVoucher` model (gift card bridge)
- `LedgerOutboxEntry` model (Xero outbox)
- `ExternalEntityMapping` sentinel-based uniqueness fix

Verify migration applied:
```bash
DATABASE_URL="<staging-db-url>" npx prisma migrate status
```

## 2. Environment Variables

Set these new env vars (all optional, sensible defaults):

| Variable | Default | Purpose |
|---|---|---|
| `LOYALTY_POS_VOUCHER_ENABLED` | `false` | Gate POS gift card voucher issuance |
| `POS_GIFT_CARD_MIN_AMOUNT` | `1` | Lightspeed gift card minimum amount |
| `POS_GIFT_CARD_MAX_AMOUNT` | `500` | Lightspeed gift card maximum amount |
| `ACCOUNTING_ENABLED` | `false` | Gate HOS-to-Xero posting |
| `XERO_CLIENT_ID` | — | Xero OAuth app client ID |
| `XERO_CLIENT_SECRET` | — | Xero OAuth app client secret |
| `XERO_REDIRECT_URI` | — | Xero OAuth callback URL |
| `XERO_TENANT_ID` | — | Xero organisation tenant ID |
| `ACCOUNTING_LEDGER_DRAIN_CRON` | — | Cron for outbox drain (e.g. `0 */6 * * *`) |

## 3. Feature Flag Rollout (in order)

Follow this sequence — each gate must be verified before enabling the next.

### Phase 0: POS ingestion fixes (no flag needed)
Fixes are active when `POS_ENABLED=true`. Verify:
- [ ] Lightspeed webhook signature validation works with real webhooks
- [ ] Sales poll imports with correct totals (not zeros)
- [ ] Pagination cursor persists across poll cycles
- [ ] OAuth 401 refresh works during long polling runs

### Phase 0.5: Identity resolution (no flag needed)
Active when loyalty is enabled. Verify:
- [ ] `syncCustomer` searches by customer_code then email before creating
- [ ] Customer mappings use account-level sentinel key (not per-store)
- [ ] Phone numbers normalised to E.164 on write
- [ ] Run identity backfill job, review queue for ambiguous matches

### Phase 1: Loyalty ledger hardening (no flag needed)
- [ ] Verify idempotency keys prevent duplicate earn/burn transactions
- [ ] `POSSale.loyaltyPointsRedeemed` written on in-store burns
- [ ] Replay same earn request — returns prior result, no duplicate

### Phase 2: POS voucher bridge
Enable: `LOYALTY_POS_VOUCHER_ENABLED=true` (one store only)
- [ ] Staff can look up member, burn points, receive gift card number
- [ ] Gift card appears in Lightspeed with correct balance
- [ ] Failed issuance reverses burn, voucher marked FAILED
- [ ] Retry with same idempotencyKey resumes (no double-burn)
- [ ] Amount limits respected (min/max validation)
- [ ] Set a low daily redemption cap initially

### Phase 3: Gift card reconciliation
Enable recon cron job. Verify:
- [ ] Reconciliation job runs, matches vouchers to Lightspeed cards
- [ ] Drift detected and recorded in DiscrepanciesService
- [ ] Run for one full week with zero unexplained discrepancies

### Phase 4: Xero accounting
Enable: `ACCOUNTING_ENABLED=true` + `FeatureFlag.ACCOUNTING_XERO=true`
- [ ] Connect Xero via OAuth (admin → accounting → connect)
- [ ] Chart of accounts seeded from Xero
- [ ] Manual journal posting works (test with Xero demo org first)
- [ ] Daily journals balance to zero
- [ ] No POSSale amounts reach Xero (guardrail test)
- [ ] Run against demo org for a full month before production

### Phase 5: Admin UI and reporting
- [ ] Admin accounting page loads, shows outbox status
- [ ] Three-way reconciliation view renders
- [ ] Points liability report matches Xero liability account
- [ ] CSV export works with large datasets (returns 400 on >5000 rows)

## 4. Post-deployment Verification

```bash
# Health check
curl https://staging-api.example.com/health

# Run smoke tests
cd services/api && NODE_ENV=staging npx jest --testPathPattern='e2e' --no-coverage
```

- [ ] All API endpoints respond correctly
- [ ] No unexpected errors in logs
- [ ] Feature flags default to OFF for new features
- [ ] Existing functionality unaffected (loyalty, orders, payments)

## 5. Rollback Plan

If issues arise:
1. Disable feature flags: `ACCOUNTING_ENABLED=false`, `LOYALTY_POS_VOUCHER_ENABLED=false`
2. The migration is additive (new columns/tables only) — no rollback needed for schema
3. If critical: revert to previous deployment, flags stay off
