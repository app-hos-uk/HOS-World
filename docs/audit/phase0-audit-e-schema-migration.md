# Audit E — Schema Migration Safety

Date: 2026-10-06
Scope: unique-constraint changes, additive columns, backfill, and zero-data-loss sequencing for the multi-market schema.
Database: PostgreSQL 15. ORM: Prisma 6 (`services/api/package.json`, `@prisma/client` and `prisma` `^6.0.0`).
Schema: `services/api/prisma/schema.prisma`.
Migration history: **109** `migration.sql` files under `services/api/prisma/migrations/`. Latest folder timestamp in the tree is `20261027120000_migrate_seller_to_b2c_seller`. A new migration must sort after that.

This audit did not connect to a database. Row counts and product-slug collisions are unknown until the preflight SQL in sections 5 and 6 is run against production (and staging). Seed files were used where they exist.

US market id, already inserted by `20261021120000_hybrid_access_control`:

```text
00000000-0000-4000-8000-000000000001
code = 'US', isDefault = true
```

That insert is `ON CONFLICT ("code") DO NOTHING`. Backfill must resolve the id by `code = 'US'`, then fall back to the constant only if that row is the one present. Do not assume the constant if an older US row won the conflict.

---

## 1. Current schema state

### E1. FoundingMember — lines 5018–5043

```5018:5043:services/api/prisma/schema.prisma
model FoundingMember {
  id              String   @id @default(uuid())
  email           String   @unique
  // ...
  countryCode     String?
  status          String   @default("REGISTERED")
  userId          String?  @unique
  user            User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  // ...
  @@index([email])
  @@index([status])
  @@index([registeredAt])
  @@map("founding_members")
}
```

Physical indexes (`20261003000000_founding_members_email_verification`):

| Index | Columns | Kind |
|---|---|---|
| `founding_members_email_key` | `email` | UNIQUE |
| `founding_members_userId_key` | `userId` | UNIQUE (NULLs allowed to repeat) |
| `founding_members_email_idx` | `email` | non-unique |
| `founding_members_userId_fkey` | `userId` → `users.id` | FK, ON DELETE SET NULL |

`countryCode` was added later (`20261012000000_add_iso_country_codes`). There is no `marketId`.

`User.foundingMember FoundingMember?` (schema line 107) is a one-to-one because `userId` is `@unique`. The planned change touches `email`, not `userId`, so this relation stays valid. It also means one user can still be linked to only one founding-member row even after email becomes unique per market. A second-market row for the same person can be inserted (different `marketId`, `userId` null) and then `linkToUser` will fail on `founding_members_userId_key` if that user is already linked.

Seed count: **no seed creates `FoundingMember` rows.** `services/api/prisma/seeds/` has zero references. The only population path is the public register API and the admin import. Production count is unknown. Preflight:

```sql
SELECT COUNT(*) AS founding_members,
       COUNT(*) FILTER (WHERE "userId" IS NOT NULL) AS linked,
       COUNT(DISTINCT lower(email)) AS distinct_emails
FROM founding_members;
```

### E2. LoyaltyMembership — lines 3731–3790

```3731:3750:services/api/prisma/schema.prisma
model LoyaltyMembership {
  id                  String               @id @default(uuid())
  userId              String               @unique
  user                User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  tierId              String
  tier                LoyaltyTier          @relation(fields: [tierId], references: [id])
  -- ...
  cardNumber          String?              @unique
  regionCode          String               @default("US")
```

`User.loyaltyMembership LoyaltyMembership?` (schema line 147) is one-to-one solely because `userId` is `@unique`. Replacing that with `@@unique([userId, marketId])` makes the relation illegal in Prisma. It must become `loyaltyMemberships LoyaltyMembership[]`. Every `include`, `select`, and `where` that treats `loyaltyMembership` as a single object breaks at generate time, not only `findUnique`.

Other uniques that the plan does not change, and that still assume one global identity:

- `loyalty_memberships_cardNumber_key` on `cardNumber` (nullable; multiple NULLs are allowed today).
- FK `userId` → `users.id` ON DELETE CASCADE.

`regionCode` default was `GB` in `20260420120000_loyalty_phase1_core` and was rewritten to `US` by `20261011120000_us_region_normalisation` (`UPDATE ... SET "regionCode" = 'US' WHERE "regionCode" = 'GB'`). Backfill should map `regionCode` onto `markets.code`, with US as the fallback, rather than blindly stamping every row as US if any non-US codes survived.

Seed: `prisma/seeds/loyalty-seed.ts` creates one membership per user that has `loyaltyPoints > 0` and `loyaltyMembership: null`. It does not insert a fixed count.

### E3. LoyaltyTier — lines 3708–3729

```3708:3728:services/api/prisma/schema.prisma
model LoyaltyTier {
  id               String              @id @default(uuid())
  name             String              @unique
  slug             String              @unique
  level            Int                 @unique
  -- ...
  @@map("loyalty_tiers")
}
```

Indexes: `loyalty_tiers_name_key`, `loyalty_tiers_slug_key`, `loyalty_tiers_level_key`.

Changing only `slug` to `@@unique([slug, marketId])` does **not** make tiers market-scoped. `name` and `level` stay globally unique, so a second market cannot have its own "Initiate" / level 1. Those two indexes have to move to the same composite, or market tiers must use distinct names and levels.

Seed tiers (`loyalty-seed.ts` lines 11–104), all global today:

| slug | name | level |
|---|---|---|
| `initiate` | Initiate | 1 |
| `spellcaster` | Spellcaster | 2 |
| `enchanter` | Enchanter | 3 |
| `dragon-keeper` | Dragon Keeper | 4 |
| `archmage-circle` | Archmage Circle | 5 |
| `council-of-realms` | Council of Realms | 6 |

### E4. PlatformSetting — lines 2796–2807

```2796:2807:services/api/prisma/schema.prisma
model PlatformSetting {
  id        String   @id @default(uuid())
  category  String
  key       String
  value     String   @db.Text
  @@unique([category, key])
  @@index([category])
  @@map("platform_settings")
}
```

Index: `platform_settings_category_key_key` on `(category, key)`, created in `20260710131000_add_navigation_and_testimonials`.

### E5. IntegrationConfig — lines 3297–3325

```3297:3324:services/api/prisma/schema.prisma
model IntegrationConfig {
  id            String    @id @default(uuid())
  category      String
  provider      String
  credentials   String    @db.Text // Encrypted JSON
  -- ...
  @@unique([category, provider])
  @@index([category])
  @@index([isActive])
  @@index([provider])
  @@map("integration_configs")
}
```

Index: `integration_configs_category_provider_key` on `(category, provider)`.

### E6. EmailTemplate — lines 2585–2598

The unique constraint is a single-column `@unique` on `slug`, not a composite.

```2585:2598:services/api/prisma/schema.prisma
model EmailTemplate {
  id          String   @id @default(uuid())
  slug        String   @unique
  subject     String?
  body        String   @db.Text
  variables   String[]
  description String?
  isActive    Boolean  @default(true)
  updatedBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([isActive])
}
```

There is no `@@map`. The table name is `"EmailTemplate"` (quoted PascalCase). Unique index: `EmailTemplate_slug_key` (`20261006000000_email_template_overrides`).

### E7. Product slug — lines 655–752

```733:735:services/api/prisma/schema.prisma
  deletedAt DateTime?

  @@unique([sellerId, slug])
```

`sellerId` is `String?` (line 657). Index: `products_sellerId_slug_key` on `("sellerId", "slug")` from `20251201000000_init` line 1824.

Soft delete does not exclude rows from the unique index. A deleted product still owns its slug.

Because `sellerId` is nullable, PostgreSQL already allows duplicate slugs when `sellerId` is NULL. See section 2. A global `@@unique([slug])` will reject those duplicates as well as cross-seller duplicates.

### E8. Store — lines 359–418

No `isAnchorStore` today. Adding `isAnchorStore Boolean @default(false)` is metadata-only on PostgreSQL 11+ (constant default, no table rewrite). No unique change. No backfill beyond the default.

### E9. ProductSubmission — lines 1611–1651

No `marketId` today. `productId` is already `@unique` (one submission per published product). Adding `marketId String?` with a nullable FK to `Market` (`ON DELETE SET NULL`) and `@@index([marketId])` does not rewrite existing rows. `Market` (lines 223–258) has no back-relation for submissions, founding members, loyalty, settings, or integrations. Prisma will refuse to generate until those relations are added on `Market`.

---

## 2. NULL uniqueness analysis

### PostgreSQL 15

A unique index and a unique constraint treat NULLs as distinct by default. From the PostgreSQL 15 unique-index rules: NULL is not equal to NULL, so two rows with the same non-null columns and NULL in a nullable column are **both allowed**.

```sql
CREATE UNIQUE INDEX example ON t (slug, "marketId");
-- ('gold', NULL) and ('gold', NULL) both succeed
-- ('gold', '<us-id>') twice fails
```

PostgreSQL 15 added `NULLS NOT DISTINCT` (constraints and indexes):

```sql
CREATE UNIQUE INDEX loyalty_tiers_slug_marketId_key
  ON loyalty_tiers (slug, "marketId")
  NULLS NOT DISTINCT;
-- the second ('gold', NULL) now fails
```

The same clause exists on `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE NULLS NOT DISTINCT (...)`.

This repo's migrations use unique **indexes**, not table unique constraints. Prisma's historical output in this repo is `CREATE UNIQUE INDEX ... ON ... (cols)` with no `NULLS` clause, which means `NULLS DISTINCT` (the default).

### Where this bites the plan

| Model | Planned unique | `market` column nullable? | Duplicate `(key, NULL)` allowed? |
|---|---|---|---|
| FoundingMember | `(email, marketId)` | Plan says `marketId String` (required) | No, after `SET NOT NULL` |
| LoyaltyMembership | `(userId, marketId)` | Plan says required | No, after `SET NOT NULL` |
| LoyaltyTier | `(slug, marketId)` | `String?` | **Yes, unless `NULLS NOT DISTINCT`** |
| PlatformSetting | `(category, key, marketId)` | `String?` | **Yes** |
| IntegrationConfig | `(category, provider, marketId)` | `String?` | **Yes** |
| EmailTemplate | `(slug, marketCode)` | `String?` | **Yes** |
| Product | `(slug)` | slug is already `NOT NULL` | No |

Required columns (E1, E2) do not have the NULL problem **after** the column is `NOT NULL`. They do have it during the window when the column is still nullable. Do not create the new unique index until backfill has finished and `SET NOT NULL` has succeeded.

### Prisma `@@unique` does not emit `NULLS NOT DISTINCT`

`@@unique([slug, marketId])` in Prisma 6 generates a normal unique index. The schema language has no attribute for `NULLS NOT DISTINCT`. Evidence in this repo: every unique index in `prisma/migrations/` is a plain `CREATE UNIQUE INDEX`, including composites that already include nullable columns (`products_sellerId_slug_key`).

Consequences:

1. Letting `prisma migrate dev` author the LoyaltyTier / PlatformSetting / IntegrationConfig / EmailTemplate change will **not** enforce one global row per key.
2. `findUnique` on the compound key with `marketId: null` is a TypeScript-legal query. If two `(slug, NULL)` rows exist, Prisma fetches and then errors because `findUnique` requires exactly one row.
3. A hand-written `NULLS NOT DISTINCT` index whose name matches what Prisma expects can drift. The next `prisma migrate dev` diff compares the schema, which cannot represent the clause, and may emit a drop-and-recreate that silently returns the index to `NULLS DISTINCT`.

### Recommendation for nullable uniques

Do not rely on NULL as the "global" sentinel.

Preferred, and the only shape Prisma can represent honestly:

- Add a real global market row, or use the existing default market, and store a non-null `marketId` on every settings/tier/integration/template row that is global.
- Then `@@unique` matches the database and `findUnique` keeps working.

If product wants "null means global" anyway, the migration SQL must be hand-written:

```sql
CREATE UNIQUE INDEX "loyalty_tiers_slug_marketId_key"
  ON "loyalty_tiers" (slug, "marketId")
  NULLS NOT DISTINCT;
```

and every later migration must be reviewed so Prisma does not replace that index. Partial unique indexes (`WHERE "marketId" IS NULL` plus `WHERE "marketId" IS NOT NULL`) have the same drift problem and are harder for `findUnique` to use.

`name` and `level` on `LoyaltyTier` need the same treatment if tiers are per market. Leaving them as single-column uniques blocks the feature even if slug is fixed.

---

## 3. Breaking query analysis

`findUnique` / `upsert` `where` may only use fields that are `@unique` or `@@unique`. After the constraint change, the old where-keys are removed from the generated client. `findFirst` and `findMany` still compile. They become ambiguous: `findFirst({ where: { userId } })` returns an arbitrary membership once a user has two.

`findUnique({ where: { id } })` and `update({ where: { id } })` do not break. Those are omitted below.

### E1. FoundingMember email

These call `findUnique` on the `email` unique and will not compile against the new client:

| File | Line | Call |
|---|---|---|
| `services/api/src/founding-members/founding-members.service.ts` | 539 | `findUnique({ where: { email: normalized } })` inside `findEmailConflict` |
| `services/api/src/founding-members/founding-members.service.ts` | 779 | `findByEmail` → `findUnique({ where: { email } })` |

`findByEmail` is the lookup used by `linkToUser` (line 785). `assertEmailAvailable` (line 564) calls `findEmailConflict`. Import dedup uses `findMany({ where: { email: { in: emails } } })` at line 516, which still compiles and will return every market's row. The in-memory `Set` of emails (lines 527–529) will then treat "exists in any market" as "exists", which preserves today's global-email behavior and blocks the new per-market registration until that set is keyed by `(email, marketId)`.

P2002 handling at lines 185–196 assumes the race is `founding_members.email`. After the swap the target becomes `founding_members_email_marketId_key`. The catch still works (it checks `code === 'P2002'` only) but the message stays "already a founding member" with no market.

`loyalty.service.ts` line 558 is `foundingMember.findUnique({ where: { userId } })`. That uses the **userId** unique, which the plan does not drop. It keeps compiling. It also keeps awarding the founding-member bonus from a single global row, ignoring market.

No other `foundingMember.findUnique({ where: { email } })` exists. Specs mock the method at `founding-members.service.spec.ts` lines 86 and 115.

Service methods that depend on email being globally unique:

- `findEmailConflict`, `assertEmailAvailable`, `findByEmail`, `linkToUser`
- `importMembers` duplicate detection (`loadExistingEmailSets`)
- `createMember` (the database rejects a second insert today)

### E2. LoyaltyMembership `findUnique({ where: { userId } })`

**59 call sites in 17 production files.** All of these become type errors. Lookups by `id` are unaffected and are not listed.

`services/api/src/loyalty/loyalty.service.ts` (21): lines 159, 220, 534, 592, 613, 624, 640, 725, 735, 823, 932, 1017, 1034, 1099, 1114, 1357, 1394, 1545, 1614, 1646, 1679. `enroll()` (line 159) is the idempotency gate: an existing row is returned and a second membership is never created.

`services/api/src/loyalty/engines/earn.engine.ts` (5): lines 61, 121, 430, 633, 1391. Line 61 is `ensureMembershipForUser`. The race recovery at line 121 also looks up by `userId` alone. Auto-enroll will attach points to whichever row that lookup returns.

`services/api/src/loyalty/listeners/loyalty.listener.ts` (7): lines 122, 267, 290, 360, 405, 459, 526.

`services/api/src/loyalty/loyalty-admin.controller.ts` (4): lines 372, 404, 516, 744.

`services/api/src/loyalty/services/loyalty-reversal.service.ts` (4): lines 88, 171, 310, 371.

`services/api/src/loyalty/services/pos-voucher.service.ts` (3): lines 291, 1302, 1353.

`services/api/src/events/events.service.ts` (3): lines 80, 337, 544.

`services/api/src/ambassador/ambassador.service.ts` (2): lines 103, 134.

`services/api/src/pos/sync/customer-import.service.ts` (2): lines 284, 289.

One each:

| File | Line |
|---|---|
| `services/api/src/auth/auth.service.ts` | 521 |
| `services/api/src/pos/sync/customer-sync.service.ts` | 25 |
| `services/api/src/pos/sync/sales-import.service.ts` | 429 |
| `services/api/src/partner-referrals/services/partner-incentive.service.ts` | 226 |
| `services/api/src/gamification/gamification.service.ts` | 208 |
| `services/api/src/journeys/journey.service.ts` | 370 |
| `services/api/src/brand-partnerships/brand-partnerships.controller.ts` | 28 |
| `services/api/src/messaging/messaging.service.ts` | 74 |

Services whose behavior assumes one membership per user (the 17 files above, plus writers that update by `userId` without being `findUnique`):

- `fandom-profile.service.ts` line 86 `updateMany({ where: { userId } })` — will update every market membership.
- `segmentation.service.ts` line 528 `updateMany({ where: { userId } })` — same.
- `loyalty-seed.ts` line 217 `where: { loyaltyMembership: null }` — the to-one filter.

`findMany` on `loyaltyMembership` does not break. It returns every row. Callers that then pick `rows[0]` or aggregate balances across "the" membership will mix markets. Notable readers: `tier.engine.ts` line 39 (all ids, safe), `loyalty-admin.controller.ts` list (line 294), `events.service.ts` line 959, `ambassador.service.ts` line 646, `journey-admin.controller.ts` line 231, `marketing.jobs.ts` line 123, `loyalty.jobs.ts` lines 166 and 255, `pos-admin.controller.ts` line 262, `fandom-profile.service.ts` line 98, `loyalty-member-email.service.ts` lines 103 and 131.

`findFirst` by card number (`pos-voucher.service.ts` line 1016, `pos-promo-code.service.ts` line 776) stays valid because `cardNumber` remains `@unique`.

### E2 relation break (larger than findUnique)

These use `User.loyaltyMembership` as a to-one relation. Prisma renames the field when the unique on `userId` is removed. Filters of the form `loyaltyMembership: { is: ... }` and `loyaltyMembership: { isNot: null }` change shape to `some` / `none` on a list.

| File | What breaks |
|---|---|
| `services/api/src/segmentation/engines/rule-evaluator.ts` | Lines 264–505. Almost every loyalty segment rule is a to-one filter, including `isNot: null` at line 505. |
| `services/api/src/segmentation/segmentation.service.ts` | Lines 439, 489 |
| `services/api/src/journeys/journey.service.ts` | Includes at lines 267 and 334; field path `user.loyaltyMembership.*` at lines 331–370 |
| `services/api/src/stores/store-staff-customer.service.ts` | Lines 94, 120, 151, 167, 186, 200, 213 (`isNot: null`) |
| `services/api/src/loyalty/loyalty.service.ts` | Staff lookup include at line 1224; type at line 1186 expects one object |
| `services/api/src/loyalty/services/pos-voucher.service.ts` | Includes at lines 1025 and 1034 |
| `services/api/src/loyalty/services/pos-promo-code.service.ts` | Includes at lines 784 and 792 |
| `services/api/src/pos/sync/customer-import.service.ts` | Include at line 210 |
| `services/api/src/pos/sync/customer-identity-backfill.service.ts` | Include at line 162 |
| `services/api/prisma/seeds/loyalty-seed.ts` | Line 217 `loyaltyMembership: null` |

### E3. LoyaltyTier slug

Tiers are **not** resolved with `findUnique({ where: { slug } })` in application code. They use `findFirst`:

| File | Line | Query |
|---|---|---|
| `services/api/src/loyalty/loyalty.service.ts` | 1745, 1763 | `findFirst({ where: { slug: 'initiate', isActive: true } })` |
| `services/api/src/loyalty/engines/earn.engine.ts` | 73, 90 | same |
| `services/api/src/loyalty/listeners/loyalty.listener.ts` | 272 | same |
| `services/api/prisma/seeds/loyalty-seed.ts` | 213, 222 | `findFirst` by slug, and by threshold |
| `services/api/src/loyalty/loyalty.service.ts` | 946 | `findFirst` for the next tier (by level) |

`findFirst` still compiles. With two active `initiate` rows it returns an arbitrary tier, and new members in every market get that tier's id.

These **do** break, because they use the unique:

| File | Line | Query |
|---|---|---|
| `services/api/prisma/seeds/loyalty-seed.ts` | 107 | `loyaltyTier.upsert({ where: { slug: t.slug } })` |
| `services/api/src/loyalty/loyalty-admin.controller.ts` | 85 | `findUnique({ where: { id } })` — **does not break** |

Admin tier update (line 113) is `update({ where: { id } })` and survives. `findMany` of all tiers (line 78) survives and will mix markets in one list until it filters on `marketId`.

`earn.engine.ts` lines 78–88 `create` an Initiate tier on the fly if missing. A second market's create will fail on `loyalty_tiers_name_key` or `loyalty_tiers_level_key` even after the slug unique is widened.

### E4. PlatformSetting

`FeatureFlagsService.isEnabled()` does not query on each call. It reads an in-memory `Map`.

Load path:

- `onModuleInit` → `refreshFromDb` (`feature-flags.service.ts` lines 122–134)
- Query: `platformSetting.findMany({ where: { category: 'feature_flag' } })`
- For each known flag, `rows.find((r) => r.key === flag)` takes the **first** row with that key. A market-specific row and a global row for the same key make the flag nondeterministic. `isEnabled` (line 75) then returns that cached boolean. Refresh interval is 30 seconds (`CACHE_TTL_MS`).

Write path, which **breaks**:

```93:97:services/api/src/config/feature-flags.service.ts
      await this.prisma.platformSetting.upsert({
        where: { category_key: { category: 'feature_flag', key: flag } },
        update: { value: String(enabled) },
        create: { category: 'feature_flag', key: flag, value: String(enabled) },
      });
```

The compound name `category_key` becomes `category_key_marketId`. `setFlag` is the only writer. `findMany` by category is the only reader. No other service queries `platformSetting` (confirmed by search). Admin `GET/PUT` flags go through `FeatureFlagsService` from `admin.controller.ts` lines 52 and 68.

If the unique allows two `(feature_flag, FOUNDING_MEMBERS, NULL)` rows, `upsert` cannot target them and `find` picks one at random. Feature flags must stay a single global row per key until `isEnabled` takes a market argument.

### E5. IntegrationConfig

`getActiveIntegration` does **not** use the unique. It is a `findFirst`:

```257:264:services/api/src/integrations/integrations.service.ts
  async getActiveIntegration(category: string): Promise<IntegrationResponseDto | null> {
    const integration = await this.prisma.integrationConfig.findFirst({
      where: {
        category,
        isActive: true,
      },
      orderBy: { priority: 'desc' },
    });
```

After market rows exist, this returns the highest-priority active provider **across all markets**. `notifications.service.ts` line 83 calls it for `EMAIL`. `integrations.controller.ts` line 182 exposes it. The query still compiles. It is the wrong query for per-market credentials.

`findUnique` / `upsert` on `category_provider` **break**:

| File | Line |
|---|---|
| `services/api/src/integrations/integrations.service.ts` | 139 (`create` existence check), 241 (`findByProvider`), 526 (`getDecryptedCredentials(category, provider)`) |
| `services/api/src/accounting/accounting.service.ts` | 67, 92 |
| `services/api/src/accounting/xero-auth.service.ts` | 247 (`upsert`), 275 |
| `services/api/src/shipping/courier/courier-factory.service.ts` | 481 |
| `services/api/src/orders/order-shipping.service.ts` | 427 (Shippo) |
| `services/api/src/tax/tax-factory.service.ts` | 396 |
| `services/api/scripts/setup-stripe-live.ts` | 114 |

`findUnique({ where: { id } })` in the same files does not break. `findMany` by category (`integrations.service.ts` line 214, `tax-factory` line 51, `courier-factory` line 74) does not break and will list every market.

Credential crypto is unchanged by the migration and must not be rewritten:

- `EncryptionService` (`services/api/src/integrations/encryption.service.ts`): AES-256-GCM, key from `INTEGRATION_ENCRYPTION_KEY` (64 hex chars). Dev fallback is a SHA-256 of a fixed string and is refused in production/staging.
- `encrypt`: random 32-byte salt + 16-byte IV, PBKDF2-SHA256 100,000 iterations, 16-byte auth tag. Payload is `base64(salt || iv || authTag || ciphertext)`.
- `encryptJson` / `decryptJson` JSON-encode before encrypt.
- `IntegrationsService.decryptCredentials` (line 550) calls `decryptJson` and returns `{}` on failure.
- `getDecryptedCredentials` (line 519) loads by id or by `category_provider`, requires `isActive`, then decrypts.

Adding `marketId` does not touch `credentials`. A copied row for a second market can keep the same ciphertext; it still decrypts with the same key. Do not re-encrypt during backfill.

### E6. EmailTemplate `slug`

| File | Line | Call |
|---|---|---|
| `services/api/src/templates/templates.service.ts` | 1046 | `findUnique({ where: { slug } })` in `resolve` |
| same | 1088 | `findUnique({ where: { slug } })` for custom templates |
| same | 1226 | `upsert({ where: { slug: data.name } })` |
| same | 1279 | `findUnique({ where: { slug } })` |
| same | 1283 | `update({ where: { slug } })` |
| same | 1339 | `findUnique({ where: { slug } })` in `hasEmailOverride` |
| `services/api/src/email/admin-email.service.ts` | 171 | `upsert({ where: { slug: snapshotSlug } })` where `snapshotSlug` is `admin_campaign_<id>` |

`deleteMany({ where: { slug } })` at `templates.service.ts` line 1331 still compiles and would delete every market's copy of that slug.

`findMany({ where: { isActive: true } })` at line 1116 still compiles. `listTemplates` merges by slug only (line 1120). Two markets' overrides of `order_shipped` collapse to whichever row is visited last.

### E7. Product `sellerId_slug`

Only three call sites, all in `services/api/src/products/products.service.ts`:

| Line | Method | Use |
|---|---|---|
| 110–115 | `create` | collision loop: `findUnique({ where: { sellerId_slug: { sellerId, slug } } })`, then `slug = baseSlug-${counter}` |
| 582–588 | `findBySlug` | public lookup by seller slug + product slug |
| 1240–1245 | bundle create | same collision loop as `create` |

`slugify` comes from `@hos-marketplace/utils`. The loop is per seller, so two sellers can both own `elder-wand` today. After `@@unique([slug])` the compound input `sellerId_slug` disappears. The loop must use `findUnique({ where: { slug } })` or `findFirst({ where: { slug } })`, and the suffix must be unique **globally**.

Admin product create already checks globally and does not use the compound key:

- `services/api/src/admin/products.service.ts` line 245: `while (await this.prisma.product.findFirst({ where: { slug } }))`
- line 527: same, excluding the current id on rename

Those `findFirst` calls survive and match the new constraint.

`findBySlugOnly` (`products.service.ts` line 644) is `findFirst({ where: { slug } })`. It survives. Today, if two sellers share a slug, it returns one of them with no error. That is a live ambiguity the global unique would close.

Other `product.findUnique` calls in the repo use `where: { id }` and do not break. Specs in `products.service.spec.ts` assert `where: { id }` (lines 138 and 192), not `sellerId_slug`.

---

## 4. Migration script sequence

One Prisma migration, hand-edited, applied in a single transaction so a failure rolls the DDL back. Name it after the latest folder, for example `20261028120000_market_scope_unique_constraints`. Do not use `CREATE INDEX CONCURRENTLY` inside this file: Prisma runs each PostgreSQL migration in a transaction, and `CONCURRENTLY` cannot run there.

Run section 6 preflight **before** this migration. Abort if product slug collisions exist and have not been renamed.

```sql
-- ---------------------------------------------------------------------------
-- 0. Resolve the US market. Abort if it is missing.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  us_id text;
BEGIN
  SELECT id INTO us_id FROM markets WHERE code = 'US' LIMIT 1;
  IF us_id IS NULL THEN
    RAISE EXCEPTION 'markets row code=US is missing; refusing to backfill';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Additive columns. Nullable first so existing rows are not rewritten
--    with a fake id and so a crash leaves the old uniques intact.
-- ---------------------------------------------------------------------------
ALTER TABLE founding_members
  ADD COLUMN IF NOT EXISTS "marketId" TEXT;

ALTER TABLE loyalty_memberships
  ADD COLUMN IF NOT EXISTS "marketId" TEXT;

ALTER TABLE loyalty_tiers
  ADD COLUMN IF NOT EXISTS "marketId" TEXT;

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS "marketId" TEXT;

ALTER TABLE integration_configs
  ADD COLUMN IF NOT EXISTS "marketId" TEXT;

ALTER TABLE "EmailTemplate"
  ADD COLUMN IF NOT EXISTS "marketCode" TEXT;

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS "isAnchorStore" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE product_submissions
  ADD COLUMN IF NOT EXISTS "marketId" TEXT;

-- ---------------------------------------------------------------------------
-- 2. Backfill required FKs. See section 5 for the statements.
--    Loyalty memberships follow regionCode. Founding members follow the
--    stated plan: every existing row is the US market.
--    Nullable-scope tables (tiers, settings, integrations, templates)
--    stay NULL, meaning global, until NULLS NOT DISTINCT indexes exist.
--    Product submissions stay NULL (E9).
-- ---------------------------------------------------------------------------

-- (section 5 SQL goes here)

-- ---------------------------------------------------------------------------
-- 3. Required columns become NOT NULL only after zero nulls remain.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM founding_members WHERE "marketId" IS NULL) THEN
    RAISE EXCEPTION 'founding_members.marketId backfill incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM loyalty_memberships WHERE "marketId" IS NULL) THEN
    RAISE EXCEPTION 'loyalty_memberships.marketId backfill incomplete';
  END IF;
END $$;

ALTER TABLE founding_members
  ALTER COLUMN "marketId" SET NOT NULL;

ALTER TABLE loyalty_memberships
  ALTER COLUMN "marketId" SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Foreign keys. NOT VALID + VALIDATE takes a shorter lock on the write
--    path than a single ADD CONSTRAINT that validates immediately. Inside
--    this transaction the difference is small; the pattern is still the
--    one to keep if this is later split for a large table.
-- ---------------------------------------------------------------------------
ALTER TABLE founding_members
  ADD CONSTRAINT founding_members_marketId_fkey
  FOREIGN KEY ("marketId") REFERENCES markets(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE loyalty_memberships
  ADD CONSTRAINT loyalty_memberships_marketId_fkey
  FOREIGN KEY ("marketId") REFERENCES markets(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE loyalty_tiers
  ADD CONSTRAINT loyalty_tiers_marketId_fkey
  FOREIGN KEY ("marketId") REFERENCES markets(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE platform_settings
  ADD CONSTRAINT platform_settings_marketId_fkey
  FOREIGN KEY ("marketId") REFERENCES markets(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE integration_configs
  ADD CONSTRAINT integration_configs_marketId_fkey
  FOREIGN KEY ("marketId") REFERENCES markets(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE product_submissions
  ADD CONSTRAINT product_submissions_marketId_fkey
  FOREIGN KEY ("marketId") REFERENCES markets(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS founding_members_marketId_idx
  ON founding_members ("marketId");
CREATE INDEX IF NOT EXISTS loyalty_memberships_marketId_idx
  ON loyalty_memberships ("marketId");
CREATE INDEX IF NOT EXISTS loyalty_tiers_marketId_idx
  ON loyalty_tiers ("marketId");
CREATE INDEX IF NOT EXISTS platform_settings_marketId_idx
  ON platform_settings ("marketId");
CREATE INDEX IF NOT EXISTS integration_configs_marketId_idx
  ON integration_configs ("marketId");
CREATE INDEX IF NOT EXISTS product_submissions_marketId_idx
  ON product_submissions ("marketId");

-- ---------------------------------------------------------------------------
-- 5. New uniques FIRST, while the old uniques still exist.
--    If this step fails, old constraints are still enforcing and the
--    transaction rolls the new indexes back.
-- ---------------------------------------------------------------------------

-- E1, E2: marketId is NOT NULL, so a normal unique index is correct.
CREATE UNIQUE INDEX founding_members_email_marketId_key
  ON founding_members (email, "marketId");

CREATE UNIQUE INDEX loyalty_memberships_userId_marketId_key
  ON loyalty_memberships ("userId", "marketId");

-- E3, E4, E5, E6: NULL means global. NULLS NOT DISTINCT is required.
-- Also widen LoyaltyTier name and level or per-market tiers cannot be inserted.
CREATE UNIQUE INDEX loyalty_tiers_slug_marketId_key
  ON loyalty_tiers (slug, "marketId") NULLS NOT DISTINCT;
CREATE UNIQUE INDEX loyalty_tiers_name_marketId_key
  ON loyalty_tiers (name, "marketId") NULLS NOT DISTINCT;
CREATE UNIQUE INDEX loyalty_tiers_level_marketId_key
  ON loyalty_tiers (level, "marketId") NULLS NOT DISTINCT;

CREATE UNIQUE INDEX platform_settings_category_key_marketId_key
  ON platform_settings (category, key, "marketId") NULLS NOT DISTINCT;

CREATE UNIQUE INDEX integration_configs_category_provider_marketId_key
  ON integration_configs (category, provider, "marketId") NULLS NOT DISTINCT;

CREATE UNIQUE INDEX "EmailTemplate_slug_marketCode_key"
  ON "EmailTemplate" (slug, "marketCode") NULLS NOT DISTINCT;

-- E7: global slug. Run only after section 6 reports zero duplicate slugs.
CREATE UNIQUE INDEX products_slug_key ON products (slug);

-- ---------------------------------------------------------------------------
-- 6. Drop the old uniques only after the new ones committed inside this
--    same transaction.
-- ---------------------------------------------------------------------------
DROP INDEX founding_members_email_key;
DROP INDEX loyalty_memberships_userId_key;
DROP INDEX loyalty_tiers_slug_key;
DROP INDEX loyalty_tiers_name_key;
DROP INDEX loyalty_tiers_level_key;
DROP INDEX platform_settings_category_key_key;
DROP INDEX integration_configs_category_provider_key;
DROP INDEX "EmailTemplate_slug_key";
DROP INDEX products_sellerId_slug_key;
```

Leave these indexes in place:

- `founding_members_userId_key` (still one linked user per founding-member row)
- `founding_members_email_idx` (lookup support)
- `loyalty_memberships_cardNumber_key`
- `EmailTemplate_isActive_idx`
- `platform_settings_category_idx`
- `integration_configs_*` non-unique indexes

`isAnchorStore` needs no index unless anchor stores are looked up by that flag. Add one later if they are.

### What must happen before the constraint swap

1. Columns exist and are populated for every NOT NULL target.
2. Product slug preflight returns zero groups (section 6), including soft-deleted rows and `sellerId IS NULL` rows.
3. Application code that uses the old `findUnique` keys is in the **same release** as this migration. `docker-migrate.sh` runs `prisma migrate deploy` before the new process serves traffic, but a rolling deploy can still have old tasks running. Old SQL `WHERE email = $1` keeps working as long as no second `(email, otherMarket)` row is inserted. Do not drop `founding_members_email_key` in a migration that ships before the code stops inserting as if email were global, unless the deploy is a hard cutover.

A safer two-release split, if a rolling deploy cannot be avoided:

1. Release A: add columns, backfill, NOT NULL, FKs, **add** new uniques, **keep** old uniques. Old code keeps working. New per-market duplicates are still rejected by the old indexes. Product global unique cannot be added in this release if it is stricter than the old composite and collisions remain; it can be added once deduped, and it may coexist with `products_sellerId_slug_key` because a global unique implies the composite.
2. Release B: ship the Prisma client and query changes. Then a second migration drops the old indexes (`founding_members_email_key`, `loyalty_memberships_userId_key`, tier/setting/integration/template single uniques, and `products_sellerId_slug_key`).

Release B is what actually enables two markets to share an email, a user, a tier slug, a setting key, a provider, or a template slug.

---

## 5. Backfill SQL

```sql
-- Founding members: every existing row is the US market (planned rule).
UPDATE founding_members fm
SET "marketId" = m.id
FROM markets m
WHERE m.code = 'US'
  AND fm."marketId" IS NULL;

-- Loyalty: map regionCode onto a market. Unknown codes fall back to US.
-- regionCode was normalised GB -> US in 20261011120000, so most rows are US.
UPDATE loyalty_memberships lm
SET "marketId" = m.id
FROM markets m
WHERE lm."marketId" IS NULL
  AND upper(lm."regionCode") = m.code;

UPDATE loyalty_memberships lm
SET "marketId" = m.id
FROM markets m
WHERE lm."marketId" IS NULL
  AND m.code = 'US';

-- Tiers, settings, integrations, templates: leave marketId / marketCode NULL
-- (global). Do not copy them onto US. A US copy plus a NULL global row is
-- two sources of truth, and FeatureFlagsService / getActiveIntegration
-- would read an arbitrary one.

-- Product submissions (E9): leave NULL.
-- Stores.isAnchorStore: DEFAULT false fills the column. No UPDATE.

-- Prove the required backfills.
-- Both of these must return 0 before SET NOT NULL.
SELECT COUNT(*) AS founding_members_without_market
FROM founding_members WHERE "marketId" IS NULL;

SELECT COUNT(*) AS memberships_without_market
FROM loyalty_memberships WHERE "marketId" IS NULL;
```

Optional, if founding-member country should follow the member instead of the "all US" rule. This contradicts the written plan; use it only if product agrees. Run it **instead of** the all-US update, not after.

```sql
UPDATE founding_members fm
SET "marketId" = m.id
FROM markets m
WHERE fm."marketId" IS NULL
  AND upper(fm."countryCode") = m.code;

UPDATE founding_members fm
SET "marketId" = us.id
FROM markets us
WHERE fm."marketId" IS NULL
  AND us.code = 'US';
```

No row is deleted. No credential column is rewritten. No points, balances, or template bodies are modified.

---

## 6. Collision analysis — product slug

Production cannot be queried from this audit. Seeds do not contain a cross-seller collision. `prisma/seeds/finance-seed.ts` lines 70–96 builds slugs from product names (`elder-wand-replica`, `invisibility-cloak`, and six others). Seller 1 and seller 2 receive different names, so that seed is safe. It is not evidence about production.

The current unique index does **not** prove slugs are globally unique:

- Same slug, different `sellerId`: allowed, and the seller create path (`products.service.ts` lines 105–116) is written to allow it.
- Same slug, `sellerId` NULL: allowed, because PostgreSQL treats NULLs as distinct in `products_sellerId_slug_key`. Admin create (`admin/products.service.ts` line 245) checks globally in application code, but the database does not, and any path that bypasses that check (SQL, an older bug, a direct Prisma create) can have inserted duplicates.
- Same slug on a live row and a soft-deleted row: the unique index includes `deletedAt IS NOT NULL` rows. Those will fail `CREATE UNIQUE INDEX products_slug_key`.

Preflight. The migration must not run while any of these return rows.

```sql
-- Cross-seller and null-seller duplicates, including soft-deleted rows.
SELECT slug,
       COUNT(*) AS rows,
       COUNT(DISTINCT "sellerId") AS distinct_sellers,
       COUNT(*) FILTER (WHERE "sellerId" IS NULL) AS null_seller_rows,
       COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL) AS deleted_rows
FROM products
GROUP BY slug
HAVING COUNT(*) > 1
ORDER BY rows DESC, slug;

-- Exact pairs, for the rename worksheet.
SELECT slug, id, "sellerId", status, "deletedAt", "createdAt"
FROM products
WHERE slug IN (
  SELECT slug FROM products GROUP BY slug HAVING COUNT(*) > 1
)
ORDER BY slug, "createdAt";
```

If the first query returns rows, rename losers before creating `products_slug_key`. Keep the oldest `createdAt` row's slug. Suffix the others. Do not delete products, and do not clear `deletedAt` handling by dropping rows.

```sql
-- Preview only. Apply as UPDATE ... FROM this set after a human checks it.
WITH ranked AS (
  SELECT id,
         slug,
         ROW_NUMBER() OVER (PARTITION BY slug ORDER BY "createdAt", id) AS rn
  FROM products
)
SELECT id,
       slug AS old_slug,
       slug || '-' || rn AS new_slug
FROM ranked
WHERE rn > 1;
```

Then:

```sql
-- Example of the write, after the preview is accepted.
WITH ranked AS (
  SELECT id,
         slug,
         ROW_NUMBER() OVER (PARTITION BY slug ORDER BY "createdAt", id) AS rn
  FROM products
)
UPDATE products p
SET slug = r.slug || '-' || r.rn
FROM ranked r
WHERE p.id = r.id
  AND r.rn > 1;
```

Storefront URLs that used the old slug will 404. Record `id, old_slug, new_slug` in a side table before the update if those URLs must redirect. That side table is not in the schema today; add it only if product wants redirects.

Slug generation after the constraint change:

- Seller create and bundle create must stop using `sellerId_slug` and must probe the slug globally, including soft-deleted rows (`findFirst({ where: { slug } })` with no `deletedAt: null` filter).
- Admin create already probes globally and is the pattern to copy.
- There is no database-level retry. Two concurrent creates of the same base slug can both pass the loop and one will get P2002. The seller create path does not catch P2002 today. Add a retry or catch when the unique becomes global, because collisions become more common.

---

## 7. Rollback plan

Prisma has no down migrations. `migrate deploy` records the folder name in `_prisma_migrations`. A failed migration inside the transaction leaves PostgreSQL unchanged and marks the row failed. The app must not start. `docker-migrate.sh` already fails closed on the second `migrate deploy`. Clear the failed row only after confirming the transaction rolled back:

```bash
cd services/api
npx prisma migrate resolve --rolled-back 20261028120000_market_scope_unique_constraints
```

Do not use `--applied` unless the SQL actually committed.

If the migration committed and must be undone, ship a **forward** migration (or run the SQL below and then `migrate resolve`). Order matters: restore old uniques before dropping new columns.

```sql
-- 1. Restore old uniques. These fail if per-market duplicates were inserted
--    after the swap. Deduplicate first; do not delete user data blindly.
CREATE UNIQUE INDEX founding_members_email_key ON founding_members (email);
CREATE UNIQUE INDEX loyalty_memberships_userId_key ON loyalty_memberships ("userId");
CREATE UNIQUE INDEX loyalty_tiers_slug_key ON loyalty_tiers (slug);
CREATE UNIQUE INDEX loyalty_tiers_name_key ON loyalty_tiers (name);
CREATE UNIQUE INDEX loyalty_tiers_level_key ON loyalty_tiers (level);
CREATE UNIQUE INDEX platform_settings_category_key_key ON platform_settings (category, key);
CREATE UNIQUE INDEX integration_configs_category_provider_key ON integration_configs (category, provider);
CREATE UNIQUE INDEX "EmailTemplate_slug_key" ON "EmailTemplate" (slug);
CREATE UNIQUE INDEX products_sellerId_slug_key ON products ("sellerId", slug);

-- 2. Drop the new uniques.
DROP INDEX IF EXISTS founding_members_email_marketId_key;
DROP INDEX IF EXISTS loyalty_memberships_userId_marketId_key;
DROP INDEX IF EXISTS loyalty_tiers_slug_marketId_key;
DROP INDEX IF EXISTS loyalty_tiers_name_marketId_key;
DROP INDEX IF EXISTS loyalty_tiers_level_marketId_key;
DROP INDEX IF EXISTS platform_settings_category_key_marketId_key;
DROP INDEX IF EXISTS integration_configs_category_provider_marketId_key;
DROP INDEX IF EXISTS "EmailTemplate_slug_marketCode_key";
DROP INDEX IF EXISTS products_slug_key;

-- 3. Drop FKs and columns. Safe for data: values are discarded, rows remain.
ALTER TABLE founding_members DROP CONSTRAINT IF EXISTS founding_members_marketId_fkey;
ALTER TABLE loyalty_memberships DROP CONSTRAINT IF EXISTS loyalty_memberships_marketId_fkey;
ALTER TABLE loyalty_tiers DROP CONSTRAINT IF EXISTS loyalty_tiers_marketId_fkey;
ALTER TABLE platform_settings DROP CONSTRAINT IF EXISTS platform_settings_marketId_fkey;
ALTER TABLE integration_configs DROP CONSTRAINT IF EXISTS integration_configs_marketId_fkey;
ALTER TABLE product_submissions DROP CONSTRAINT IF EXISTS product_submissions_marketId_fkey;

ALTER TABLE founding_members DROP COLUMN IF EXISTS "marketId";
ALTER TABLE loyalty_memberships DROP COLUMN IF EXISTS "marketId";
ALTER TABLE loyalty_tiers DROP COLUMN IF EXISTS "marketId";
ALTER TABLE platform_settings DROP COLUMN IF EXISTS "marketId";
ALTER TABLE integration_configs DROP COLUMN IF EXISTS "marketId";
ALTER TABLE "EmailTemplate" DROP COLUMN IF EXISTS "marketCode";
ALTER TABLE product_submissions DROP COLUMN IF EXISTS "marketId";
ALTER TABLE stores DROP COLUMN IF EXISTS "isAnchorStore";
```

Product slug renames are not reversed by the DDL above. Reverse them from the preview table (`old_slug` → `slug`) before recreating `products_sellerId_slug_key` if a renamed slug now collides with the restored composite (unlikely if the suffix was appended, but the original slug is the one to put back).

Code rollback must match. A new Prisma client cannot talk to a database that only has `email @unique` if the schema says `@@unique([email, marketId])`, and the old client cannot call `email_marketId`. Revert the schema and regenerate the client in the same rollback release.

Per-step abort points before commit:

| Step | If it fails | Data loss |
|---|---|---|
| ADD COLUMN nullable / `isAnchorStore` default | Transaction rolls back. Retry. | None |
| UPDATE backfill | Transaction rolls back. Fix the US market row and retry. | None |
| SET NOT NULL | Aborts if any NULL remains. Backfill again. | None |
| ADD FK | Aborts if an id is not in `markets`. | None |
| CREATE new unique | Aborts on duplicates. Fix data, retry the whole migration. Old uniques still hold if you have not dropped them. | None if the transaction rolls back |
| DROP old unique | Only after the new unique exists. Restoring the old unique is the rollback, and it fails if duplicates were inserted. | None by itself |
| Product slug UPDATE | Reversible from the saved `(id, old_slug)` list. | URLs change until reversed. Rows are not deleted. |

---

## 8. Prisma considerations

### File naming and ordering

Prisma applies folders in lexicographic order of the timestamp prefix. There are 109 migrations. The new folder must be strictly after `20261027120000_migrate_seller_to_b2c_seller`. One folder for the whole swap keeps the transaction boundary obvious. Split only if you adopt the two-release plan in section 4: `..._add_market_columns` then `..._swap_unique_indexes`.

Checksums are the source of truth. Do not edit a migration after it has been applied in any environment. `docs/PRISMA_MIGRATE_DEV_FIX.md` already records checksum drift from edited historical files. A new file avoids that.

`prisma migrate dev` replays the full history onto a shadow database. That path has failed before (P3006, missing `users` in the shadow DB, fixed by `20251201000000_init`). Prefer writing this migration by hand and applying it with `prisma migrate deploy`, then `prisma generate`. If `migrate dev` is used, it will try to emit `@@unique` without `NULLS NOT DISTINCT` and will also try to drop `name` / `level` uniques only if the schema says so. Edit the generated SQL before the first deploy.

### Custom SQL

Backfill and `NULLS NOT DISTINCT` belong in `migration.sql`, not in a seed and not in application startup. Seeds are not run by `migrate deploy`.

After the SQL uses `NULLS NOT DISTINCT`, the Prisma schema still cannot say that. Expect `prisma migrate diff` to want a different index on the next unrelated schema change. Before merging any later migration, diff against production and reject a drop of `loyalty_tiers_slug_marketId_key` (and the other `NULLS NOT DISTINCT` indexes) unless the replacement has the same clause.

The alternative that avoids this permanently: non-null `marketId` on tiers, settings, integrations, and templates, with global rows pointing at the US market or a dedicated global market. Then the schema and the database match and Prisma can own the index.

### `prisma migrate deploy` in production

- Applies only pending migrations, in order, each in a transaction on PostgreSQL.
- A statement error rolls that migration's transaction back and writes a failed row. Later migrations do not run.
- The process exit code is non-zero. `docker-migrate.sh` treats that as failure on the fast path and falls through to reconciliation, then runs `migrate deploy` again. The second attempt also fails until `migrate resolve --rolled-back` (and a fixed migration, which must be a **new** folder if the failed SQL was already recorded).
- Deploy does not run seeds and does not regenerate the client. The image must already contain the generated client that matches the schema.

### `docker-migrate.sh` fast path

`services/api/docker-migrate.sh` lines 17–20:

```sh
if node ./scripts/verify-repair-objects.js && npx prisma migrate deploy; then
  exit 0
fi
```

`verify-repair-objects.js` checks that historical repair objects exist. It does not need to know about new columns. On a healthy database the fast path **does** apply this migration, via `migrate deploy`. The slow path's hardcoded `db execute` list does not include the new file, and it must not: that list is for old checksum-bypass repairs. The slow path still ends with `npx prisma migrate deploy` (line 82), so the new migration runs there too.

The fast path will not special-case a long lock. `CREATE UNIQUE INDEX` on `products` takes a `SHARE` lock that blocks writes for the duration of the build. If `products` is large, schedule the deploy in a quiet window or split the product index into its own migration after measuring. Do not put `CONCURRENTLY` in a Prisma transaction.

### Client compound names after a matching schema change

| Model | Old `where` | New `where` |
|---|---|---|
| FoundingMember | `{ email }` | `{ email_marketId: { email, marketId } }` |
| LoyaltyMembership | `{ userId }` | `{ userId_marketId: { userId, marketId } }` |
| LoyaltyTier | `{ slug }`, `{ name }`, `{ level }` | `{ slug_marketId }`, `{ name_marketId }`, `{ level_marketId }` |
| PlatformSetting | `{ category_key: { category, key } }` | `{ category_key_marketId: { category, key, marketId } }` |
| IntegrationConfig | `{ category_provider: { category, provider } }` | `{ category_provider_marketId: { category, provider, marketId } }` |
| EmailTemplate | `{ slug }` | `{ slug_marketCode: { slug, marketCode } }` |
| Product | `{ sellerId_slug: { sellerId, slug } }` | `{ slug }` |

`marketId: null` is only valid in that input if the column stays nullable. With `NULLS NOT DISTINCT`, `findUnique` with null is then a real uniqueness lookup. Without it, `findUnique` with null is unsafe.

`User.loyaltyMembership` must be renamed to a list in the same schema edit. `prisma generate` fails until `Market` has the back-relations for every new FK.

---

## 9. Risk assessment

| Rank | Change | Risk | Why |
|---|---|---|---|
| 1 | LoyaltyMembership `userId` unique → `(userId, marketId)` | Critical | 59 `findUnique` sites, the `User.loyaltyMembership` to-one relation, segmentation rules, journeys, POS, earn/burn, and enroll idempotency all assume one row. A wrong row moves points and clawbacks to the wrong market. `cardNumber` stays globally unique, which is fine, but balances do not. |
| 2 | Product `@@unique([slug])` | Critical | Migration fails closed if any duplicate exists, including soft-deleted and null-seller rows. Seller create will not compile. Public `findBySlug` breaks. URL renames are user-visible. No production collision count is known. |
| 3 | LoyaltyTier slug, with `name` and `level` left global | High | `findFirst({ slug: 'initiate' })` becomes ambiguous. Creating a second Initiate fails on `name` and `level` even after the slug index is widened. NULL slug+market duplicates are allowed unless `NULLS NOT DISTINCT` is hand-written. Seed `upsert({ where: { slug } })` breaks. |
| 4 | PlatformSetting `(category, key, marketId)` nullable | High | `setFlag` upsert breaks. `refreshFromDb` picks an arbitrary row per key, so feature flags can flip based on row order. NULL duplicates are allowed by default. |
| 5 | IntegrationConfig `(category, provider, marketId)` nullable | High | Stripe, Shippo, tax, and Xero `findUnique` / `upsert` break. `getActiveIntegration` stays compiling and returns the highest priority row in any market, which can charge or email through the wrong account. Ciphertext is safe if rows are copied, not re-encrypted. |
| 6 | EmailTemplate `(slug, marketCode)` nullable | High | Template resolve, upsert, and campaign snapshots key on `slug` alone. `listTemplates` last-write-wins across markets. NULL duplicates allowed by default. Table name is `"EmailTemplate"`, not `email_templates`. |
| 7 | FoundingMember `(email, marketId)` | Medium | Only two `findUnique({ email })` sites, both in one service, plus import dedup that still treats email as global. `userId` stays globally unique, so linking the same user in a second market fails. Backfill-all-to-US is safe for the constraint and wrong if `countryCode` was meant to choose the market. |
| 8 | Prisma vs `NULLS NOT DISTINCT` drift | Medium | The next migrate diff can drop the hand-written indexes. |
| 9 | ProductSubmission.`marketId` nullable FK | Low | Additive. Existing rows stay NULL. Needs a `Market` back-relation. |
| 10 | Store.`isAnchorStore` default false | Low | Additive, constant default, no lock beyond a catalog update on PostgreSQL 15. |

---

## 10. Recommended approach

1. Run the section 6 preflight on a production snapshot. If any slug group has `COUNT(*) > 1`, rename with the ranked update and keep an `(id, old_slug, new_slug)` table. Do this before any unique index is added. Do not delete products.

2. Do not use NULL as a global key if you can avoid it. Point global tiers, settings, integrations, and email templates at a non-null market id (the US default market, unless product defines a separate global market). Then Prisma `@@unique` is honest and `findUnique` works. If NULL must mean global, hand-write `NULLS NOT DISTINCT` and block later diffs from replacing those indexes.

3. Widen LoyaltyTier `name` and `level` in the same migration as `slug`. Otherwise per-market tiers cannot be created.

4. Keep `founding_members.userId` unique for this release, and document that a user links to one founding-member row. Change it only when the product wants one person to be a founding member in several markets, and change `User.foundingMember` to a list at that time.

5. Ship the schema and the query rewrite together, after a staging migrate:
   - Replace every `findUnique({ userId })` on memberships with `findUnique({ userId_marketId })` or, until the caller has a market, `findFirst` ordered by an explicit rule (home market, then US). Do not leave a bare `findFirst({ where: { userId } })`.
   - Change `User.loyaltyMembership` to a list and update segmentation, journeys, staff customer search, and POS includes.
   - Change founding-member email lookups and the import set to `(email, marketId)`.
   - Change `category_key` and `category_provider` upserts. Make `FeatureFlagsService.refreshFromDb` and `getActiveIntegration` filter by market. Global flags should be the row you designated in step 2, not "first row wins".
   - Change email template `where: { slug }` to `(slug, marketCode)` and teach `listTemplates` not to merge markets together.
   - Change the three `sellerId_slug` lookups. `findBySlug` should load by global slug and then check `sellerId`.

6. Migration contents, in order, one transaction: add nullable columns (and `isAnchorStore`), backfill, `SET NOT NULL` on founding members and memberships, add FKs, create new unique indexes, drop old unique indexes. Backfill SQL is section 5. No deletes, no credential re-encryption.

7. Deploy with the existing fast path (`verify-repair-objects.js` then `prisma migrate deploy`). It will run this migration. Watch the products unique-index lock. If deploy fails, the transaction is already rolled back; `migrate resolve --rolled-back` and fix forward. Roll back a committed migration with the forward SQL in section 7, not by editing the applied file.

8. Leave E8 and E9 in the same migration. They are safe. They are not a reason to reorder the constraint work ahead of the preflight.
