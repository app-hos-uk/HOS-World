-- ============================================================================
-- HOS Marketplace — Production Clean-Slate Script
-- ============================================================================
--
-- PURPOSE: Prepare the database for production go-live by:
--   PHASE 1: Remove all test users (@hos.test, @hos.test.com, @yopmail.com, @houseofspells.com)
--   PHASE 2: Clear ALL financial/transactional data (orders, payments, settlements, etc.)
--   PHASE 3: Clear remaining transactional artifacts (carts, stock reservations, POS imports, etc.)
--
-- PRESERVED (not touched):
--   ✓ Real user accounts (non-test emails)
--   ✓ Founding members (real emails)
--   ✓ Loyalty memberships + current balances + tier assignments
--   ✓ Loyalty configuration (tiers, earn rules, redemption options)
--   ✓ Protected admins (app@houseofspells.co.uk, mail@jsabu.com)
--   ✓ Platform seller (platform-retail@houseofspells.internal)
--   ✓ Product catalog, categories, attributes
--   ✓ Stores, warehouses, shipping config
--   ✓ Integration configs, webhooks
--   ✓ Marketing journeys, audience segments (config)
--   ✓ Events (config), fandoms, quests, badges (config)
--
-- IMPORTANT: Prisma uses camelCase column names. Tables use snake_case (@@map)
-- or PascalCase (unmapped models like "Transaction", "SupportTicket", etc.)
--
-- INSTRUCTIONS:
--   1. pg_dump your_database > backup_before_production_cleanup.sql
--   2. Run this script inside psql or a DB client.
--   3. Review STEP 0 counts carefully.
--   4. COMMIT only if everything looks correct; ROLLBACK if anything is wrong.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 0: PRE-CLEANUP SNAPSHOT — review these before proceeding
-- ============================================================================

SELECT '========== PRE-CLEANUP COUNTS ==========' AS info;

SELECT 'total_users' AS entity, COUNT(*) AS total FROM users
UNION ALL SELECT 'test_users_to_delete', COUNT(*) FROM users
  WHERE (email LIKE '%@hos.test' OR email LIKE '%@hos.test.com'
         OR email LIKE '%@yopmail.com' OR email LIKE '%@houseofspells.com')
UNION ALL SELECT 'real_users_to_keep', COUNT(*) FROM users
  WHERE NOT (email LIKE '%@hos.test' OR email LIKE '%@hos.test.com'
             OR email LIKE '%@yopmail.com' OR email LIKE '%@houseofspells.com')
UNION ALL SELECT 'total_orders', COUNT(*) FROM orders
UNION ALL SELECT 'total_payments', COUNT(*) FROM payments
UNION ALL SELECT 'total_financial_txns', COUNT(*) FROM "Transaction"
UNION ALL SELECT 'total_settlements', COUNT(*) FROM settlements
UNION ALL SELECT 'total_pos_sales', COUNT(*) FROM pos_sales
UNION ALL SELECT 'founding_members_total', COUNT(*) FROM founding_members
UNION ALL SELECT 'founding_members_test', COUNT(*) FROM founding_members
  WHERE (email LIKE '%@hos.test' OR email LIKE '%@hos.test.com'
         OR email LIKE '%@yopmail.com' OR email LIKE '%@houseofspells.com')
UNION ALL SELECT 'founding_members_real', COUNT(*) FROM founding_members
  WHERE NOT (email LIKE '%@hos.test' OR email LIKE '%@hos.test.com'
             OR email LIKE '%@yopmail.com' OR email LIKE '%@houseofspells.com')
UNION ALL SELECT 'loyalty_members_total', COUNT(*) FROM loyalty_memberships
UNION ALL SELECT 'loyalty_members_test', COUNT(*) FROM loyalty_memberships
  WHERE "userId" IN (SELECT id FROM users WHERE email LIKE '%@hos.test' OR email LIKE '%@hos.test.com'
                     OR email LIKE '%@yopmail.com' OR email LIKE '%@houseofspells.com')
UNION ALL SELECT 'loyalty_members_real', COUNT(*) FROM loyalty_memberships
  WHERE "userId" NOT IN (SELECT id FROM users WHERE email LIKE '%@hos.test' OR email LIKE '%@hos.test.com'
                         OR email LIKE '%@yopmail.com' OR email LIKE '%@houseofspells.com')
UNION ALL SELECT 'loyalty_tiers', COUNT(*) FROM loyalty_tiers
UNION ALL SELECT 'loyalty_earn_rules', COUNT(*) FROM loyalty_earn_rules
UNION ALL SELECT 'products', COUNT(*) FROM products;

-- Confirm protected users exist
SELECT 'PROTECTED USERS (must survive):' AS info;
SELECT email, role FROM users
WHERE email IN ('app@houseofspells.co.uk', 'mail@jsabu.com', 'platform-retail@houseofspells.internal');

-- List test users that will be deleted
SELECT 'TEST USERS TO BE DELETED:' AS info;
SELECT email, role, "firstName", "lastName" FROM users
WHERE (email LIKE '%@hos.test' OR email LIKE '%@hos.test.com'
       OR email LIKE '%@yopmail.com' OR email LIKE '%@houseofspells.com')
ORDER BY email;


-- ############################################################################
--                    PHASE 1: REMOVE ALL TEST USERS
-- ############################################################################

SELECT '========== PHASE 1: Removing test users ==========' AS phase;

-- ============================================================================
-- 1.1: COLLECT TEST USER IDS
-- ============================================================================

CREATE TEMP TABLE _test_user_ids AS
SELECT id FROM users
WHERE (
    email LIKE '%@hos.test'
    OR email LIKE '%@hos.test.com'
    OR email LIKE '%@yopmail.com'
    OR email LIKE '%@houseofspells.com'
);

-- ============================================================================
-- 1.2: DELETE TEST USER LOYALTY DATA
-- ============================================================================

DELETE FROM loyalty_pos_redeem_otps WHERE "membershipId" IN
  (SELECT id FROM loyalty_memberships WHERE "userId" IN (SELECT id FROM _test_user_ids));
DELETE FROM loyalty_pos_vouchers WHERE "membershipId" IN
  (SELECT id FROM loyalty_memberships WHERE "userId" IN (SELECT id FROM _test_user_ids));
DELETE FROM loyalty_redemptions WHERE "membershipId" IN
  (SELECT id FROM loyalty_memberships WHERE "userId" IN (SELECT id FROM _test_user_ids));
DELETE FROM loyalty_transactions WHERE "membershipId" IN
  (SELECT id FROM loyalty_memberships WHERE "userId" IN (SELECT id FROM _test_user_ids));
UPDATE loyalty_referrals SET "refereeId" = NULL
  WHERE "refereeId" IN (SELECT id FROM loyalty_memberships WHERE "userId" IN (SELECT id FROM _test_user_ids));
DELETE FROM loyalty_referrals WHERE "referrerId" IN
  (SELECT id FROM loyalty_memberships WHERE "userId" IN (SELECT id FROM _test_user_ids));
DELETE FROM ugc_submissions WHERE "ambassadorId" IN
  (SELECT id FROM ambassador_profiles WHERE "userId" IN (SELECT id FROM _test_user_ids));
DELETE FROM ambassador_achievements WHERE "ambassadorId" IN
  (SELECT id FROM ambassador_profiles WHERE "userId" IN (SELECT id FROM _test_user_ids));
DELETE FROM ambassador_profiles WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM segment_memberships WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM journey_enrollments WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM message_logs WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM loyalty_memberships WHERE "userId" IN (SELECT id FROM _test_user_ids);

-- ============================================================================
-- 1.3: DELETE TEST FOUNDING MEMBERS
-- ============================================================================

DELETE FROM founding_members
WHERE (email LIKE '%@hos.test' OR email LIKE '%@hos.test.com'
       OR email LIKE '%@yopmail.com' OR email LIKE '%@houseofspells.com');

-- ============================================================================
-- 1.4: DELETE TEST USER INFLUENCER DATA
-- ============================================================================

DELETE FROM influencer_commissions WHERE "influencerId" IN
  (SELECT id FROM influencers WHERE "userId" IN (SELECT id FROM _test_user_ids));
DELETE FROM influencer_product_links WHERE "influencerId" IN
  (SELECT id FROM influencers WHERE "userId" IN (SELECT id FROM _test_user_ids));
DELETE FROM influencer_storefronts WHERE "influencerId" IN
  (SELECT id FROM influencers WHERE "userId" IN (SELECT id FROM _test_user_ids));
DELETE FROM influencer_commission_rules WHERE "influencerId" IN
  (SELECT id FROM influencers WHERE "userId" IN (SELECT id FROM _test_user_ids));
DELETE FROM referrals WHERE "influencerId" IN
  (SELECT id FROM influencers WHERE "userId" IN (SELECT id FROM _test_user_ids));
DELETE FROM influencers WHERE "userId" IN (SELECT id FROM _test_user_ids);

SELECT 'Phase 1a complete — test loyalty/founding/influencer data removed' AS status;


-- ############################################################################
--   PHASE 2: CLEAR ALL FINANCIAL / TRANSACTIONAL DATA (before user/seller FKs)
-- ############################################################################

SELECT '========== PHASE 2: Clearing all transactional data ==========' AS phase;

-- ============================================================================
-- 2.1: DELETE ALL ORDER CHILDREN (FK-safe order)
-- ============================================================================

DELETE FROM return_items WHERE "returnRequestId" IN
  (SELECT id FROM return_requests WHERE "orderId" IS NOT NULL);
DELETE FROM return_requests WHERE "orderId" IS NOT NULL;

DELETE FROM cancellation_requests;
DELETE FROM click_collect_orders;
DELETE FROM order_settlements;
DELETE FROM payments;
DELETE FROM gift_details;
DELETE FROM order_notes;
DELETE FROM order_items;

UPDATE coupon_usages SET "orderId" = NULL;
UPDATE promotion_usages SET "orderId" = NULL;
UPDATE stock_reservations SET "orderId" = NULL;
UPDATE referrals SET "orderId" = NULL, "convertedAt" = NULL;
UPDATE "SupportTicket" SET "orderId" = NULL;
UPDATE gift_card_transactions SET "orderId" = NULL;
UPDATE "Discrepancy" SET "orderId" = NULL;
UPDATE disputes SET "orderId" = NULL;

-- ============================================================================
-- 2.2: DELETE ALL FINANCIAL TRANSACTIONS
-- ============================================================================

DELETE FROM transaction_audit_logs;
DELETE FROM "Transaction";
DELETE FROM vendor_ledger_entries;

-- ============================================================================
-- 2.3: DELETE ALL SETTLEMENTS
-- ============================================================================

UPDATE "Discrepancy" SET "settlementId" = NULL;
DELETE FROM settlements;

-- ============================================================================
-- 2.4: DELETE ALL ORDERS
-- ============================================================================

UPDATE orders SET "parentOrderId" = NULL WHERE "parentOrderId" IS NOT NULL;
DELETE FROM orders;

-- ============================================================================
-- 2.5: DELETE ALL DISPUTES & DISCREPANCIES
-- ============================================================================

DELETE FROM disputes;
DELETE FROM "Discrepancy";

-- ============================================================================
-- 2.6: CLEAR RECONCILIATION DATA
-- ============================================================================

DELETE FROM reconciliation_items;
DELETE FROM reconciliation_runs;

-- ============================================================================
-- 2.7: RESET FINANCIAL PERIODS
-- ============================================================================

DELETE FROM financial_periods;

-- ============================================================================
-- 2.8: CLEAR LEDGER OUTBOX
-- ============================================================================

DELETE FROM ledger_outbox_entries;

-- Carts reference products without ON DELETE CASCADE — clear before test seller removal
DELETE FROM cart_items;
DELETE FROM carts;

SELECT 'Phase 2 complete — all financial/order data cleared' AS status;


-- ############################################################################
--                    PHASE 1b: REMOVE TEST USER ACCOUNTS
-- ############################################################################

SELECT '========== PHASE 1b: Removing test user accounts ==========' AS phase;

-- ============================================================================
-- 1.5: DELETE TEST USER SELLER DATA
-- ============================================================================

DELETE FROM seller_verification_documents
  WHERE "sellerId" IN (SELECT id FROM sellers WHERE "userId" IN (SELECT id FROM _test_user_ids));
DELETE FROM seller_theme_settings
  WHERE "sellerId" IN (SELECT id FROM sellers WHERE "userId" IN (SELECT id FROM _test_user_ids));
DELETE FROM seller_markets
  WHERE "sellerId" IN (SELECT id FROM sellers WHERE "userId" IN (SELECT id FROM _test_user_ids));
DELETE FROM vendor_ledger_entries
  WHERE "sellerId" IN (SELECT id FROM sellers WHERE "userId" IN (SELECT id FROM _test_user_ids));

-- POS connections + stores owned by test sellers
DELETE FROM pos_connections WHERE "storeId" IN
  (SELECT id FROM stores WHERE "sellerId" IN
    (SELECT id FROM sellers WHERE "userId" IN (SELECT id FROM _test_user_ids)));
DELETE FROM stores WHERE "sellerId" IN
  (SELECT id FROM sellers WHERE "userId" IN (SELECT id FROM _test_user_ids));

DELETE FROM sellers WHERE "userId" IN (SELECT id FROM _test_user_ids);

-- ============================================================================
-- 1.6: DELETE TEST USER MISC PROFILES
-- ============================================================================

DELETE FROM customers WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM addresses WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM refresh_tokens WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM oauth_accounts WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM product_reviews WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM wishlist_items WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM notifications WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM push_subscriptions WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM gdpr_consent_logs WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM event_rsvps WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM event_attendances WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM user_badges WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM user_quests WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM ai_chats WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM fandom_quiz_attempts WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM shared_items WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM collections WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM brand_campaign_redemptions WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM coupon_usages WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM promotion_usages WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM user_role_assignments WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM tenant_users WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM "SellerInvitation" WHERE "invitedBy" IN (SELECT id FROM _test_user_ids);
DELETE FROM influencer_invitations WHERE "invitedBy" IN (SELECT id FROM _test_user_ids);

-- Nullify references from shared tables
UPDATE "ActivityLog" SET "userId" = NULL WHERE "userId" IN (SELECT id FROM _test_user_ids);
UPDATE "SupportTicket" SET "userId" = NULL WHERE "userId" IN (SELECT id FROM _test_user_ids);
UPDATE "SupportTicket" SET "assignedTo" = NULL WHERE "assignedTo" IN (SELECT id FROM _test_user_ids);
UPDATE "TicketMessage" SET "userId" = NULL WHERE "userId" IN (SELECT id FROM _test_user_ids);
UPDATE "WhatsAppConversation" SET "userId" = NULL WHERE "userId" IN (SELECT id FROM _test_user_ids);
DELETE FROM partner_referral_conversions WHERE "userId" IN (SELECT id FROM _test_user_ids);
UPDATE newsletter_subscriptions SET "userId" = NULL WHERE "userId" IN (SELECT id FROM _test_user_ids);
UPDATE gift_cards SET "userId" = NULL WHERE "userId" IN (SELECT id FROM _test_user_ids);
UPDATE store_shipment_requests SET "userId" = NULL WHERE "userId" IN (SELECT id FROM _test_user_ids);
UPDATE product_views SET "userId" = NULL WHERE "userId" IN (SELECT id FROM _test_user_ids);
UPDATE cancellation_requests SET "requestedById" =
  (SELECT id FROM users WHERE email = 'app@houseofspells.co.uk' LIMIT 1)
  WHERE "requestedById" IN (SELECT id FROM _test_user_ids);
UPDATE cancellation_requests SET "sellerReviewedById" = NULL WHERE "sellerReviewedById" IN (SELECT id FROM _test_user_ids);
UPDATE cancellation_requests SET "financeReviewedById" = NULL WHERE "financeReviewedById" IN (SELECT id FROM _test_user_ids);
UPDATE cancellation_requests SET "resolvedById" = NULL WHERE "resolvedById" IN (SELECT id FROM _test_user_ids);

-- ============================================================================
-- 1.7: DELETE TEST USERS
-- ============================================================================

DELETE FROM users WHERE id IN (SELECT id FROM _test_user_ids);

DROP TABLE _test_user_ids;

SELECT 'Phase 1 complete — test users removed' AS status;


-- ############################################################################
--         PHASE 3: CLEAR REMAINING TRANSACTIONAL ARTIFACTS
-- ############################################################################

SELECT '========== PHASE 3: Clearing transactional artifacts ==========' AS phase;

-- ============================================================================
-- 3.1: CLEAR ALL CARTS
-- ============================================================================

DELETE FROM cart_items;
DELETE FROM carts;

-- ============================================================================
-- 3.2: CLEAR STOCK RESERVATIONS
-- ============================================================================

DELETE FROM stock_reservations;

-- ============================================================================
-- 3.3: CLEAR STOCK MOVEMENTS & TRANSFERS
-- ============================================================================

DELETE FROM stock_movements;
DELETE FROM stock_transfers;

-- ============================================================================
-- 3.4: CLEAR POS IMPORTED SALES
-- ============================================================================

-- Store shipment requests (linked to POS sales)
DELETE FROM shipment_group_items;
DELETE FROM shipment_groups;
DELETE FROM store_shipment_requests;

-- POS sale items → POS sales
DELETE FROM pos_sale_items;
DELETE FROM pos_sales;

-- External entity mappings (POS ↔ HOS ID mappings)
DELETE FROM external_entity_mappings;

-- Identity match reviews
DELETE FROM identity_match_reviews;

-- ============================================================================
-- 3.5: CLEAR GIFT CARD TRANSACTIONS (keep gift card definitions)
-- ============================================================================

DELETE FROM gift_card_transactions;

-- ============================================================================
-- 3.6: CLEAR REFERRAL TRACKING DATA
-- ============================================================================

DELETE FROM influencer_commissions;
DELETE FROM influencer_payouts;
DELETE FROM referrals;

-- ============================================================================
-- 3.7: CLEAR RETURN REQUESTS (remaining POS-linked ones)
-- ============================================================================

DELETE FROM return_items;
DELETE FROM return_requests;

-- ============================================================================
-- 3.8: CLEAR ACTIVITY LOGS & INTEGRATION LOGS
-- ============================================================================

DELETE FROM "ActivityLog";
DELETE FROM integration_logs;

-- ============================================================================
-- 3.9: CLEAR SUPPORT DATA (tickets, WhatsApp)
-- ============================================================================

DELETE FROM "TicketMessage";
DELETE FROM "SupportTicket";

-- WhatsApp messages → conversations
DELETE FROM "WhatsAppMessage";
DELETE FROM "WhatsAppConversation";

-- ============================================================================
-- 3.10: CLEAR COUPON / PROMOTION USAGE HISTORY
-- ============================================================================

DELETE FROM coupon_usages;
DELETE FROM promotion_usages;

-- ============================================================================
-- 3.11: CLEAR ANALYTICS SNAPSHOTS
-- ============================================================================

DELETE FROM loyalty_analytics_snapshots;
DELETE FROM campaign_attributions;

-- ============================================================================
-- 3.12: RESET POS CONNECTION SYNC CURSORS
-- (So sales polling starts fresh from now, not from old version cursors)
-- ============================================================================

UPDATE pos_connections SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{lastSaleVersion}', 'null'::jsonb
) WHERE settings IS NOT NULL AND settings->>'lastSaleVersion' IS NOT NULL;

SELECT 'Phase 3 complete — all transactional artifacts cleared' AS status;


-- ############################################################################
--                FINAL VERIFICATION — review before COMMIT
-- ############################################################################

SELECT '========== POST-CLEANUP VERIFICATION ==========' AS info;

-- Test users gone
SELECT 'remaining_test_users' AS check_name, COUNT(*) AS total FROM users
WHERE (email LIKE '%@hos.test' OR email LIKE '%@hos.test.com'
       OR email LIKE '%@yopmail.com' OR email LIKE '%@houseofspells.com');

-- Test founding members gone
SELECT 'remaining_test_founding_members' AS check_name, COUNT(*) AS total FROM founding_members
WHERE (email LIKE '%@hos.test' OR email LIKE '%@hos.test.com'
       OR email LIKE '%@yopmail.com' OR email LIKE '%@houseofspells.com');

-- All transactional data cleared
SELECT 'remaining_orders' AS check_name, COUNT(*) AS total FROM orders
UNION ALL SELECT 'remaining_payments', COUNT(*) FROM payments
UNION ALL SELECT 'remaining_transactions', COUNT(*) FROM "Transaction"
UNION ALL SELECT 'remaining_settlements', COUNT(*) FROM settlements
UNION ALL SELECT 'remaining_pos_sales', COUNT(*) FROM pos_sales
UNION ALL SELECT 'remaining_carts', COUNT(*) FROM carts;

-- PRESERVED: Protected users
SELECT 'PROTECTED USERS (must exist):' AS check_name;
SELECT email, role FROM users
WHERE email IN ('app@houseofspells.co.uk', 'mail@jsabu.com', 'platform-retail@houseofspells.internal');

-- PRESERVED: Real founding members (count should match pre-cleanup "founding_members_real")
SELECT 'real_founding_members_after' AS check_name, COUNT(*) AS total FROM founding_members;

-- PRESERVED: Real loyalty members (count should match pre-cleanup "loyalty_members_real")
SELECT 'real_loyalty_members_after' AS check_name, COUNT(*) AS total FROM loyalty_memberships;

-- PRESERVED: Loyalty configuration
SELECT 'loyalty_tiers' AS check_name, COUNT(*) AS total FROM loyalty_tiers
UNION ALL SELECT 'loyalty_earn_rules', COUNT(*) FROM loyalty_earn_rules
UNION ALL SELECT 'loyalty_redemption_options', COUNT(*) FROM loyalty_redemption_options;

-- PRESERVED: Product catalog
SELECT 'products_after' AS check_name, COUNT(*) AS total FROM products;

-- PRESERVED: Real users
SELECT 'total_remaining_users' AS check_name, COUNT(*) AS total FROM users;

-- Quick summary of remaining users by role
SELECT role, COUNT(*) AS count FROM users GROUP BY role ORDER BY count DESC;


-- ============================================================================
-- DECISION TIME:
--
--   Review the counts above. Confirm:
--     1. remaining_test_users = 0
--     2. remaining_test_founding_members = 0
--     3. All transactional counts = 0
--     4. Protected users still exist (3 rows)
--     5. real_founding_members_after matches founding_members_real from STEP 0
--     6. real_loyalty_members_after matches loyalty_members_real from STEP 0
--     7. Loyalty config counts match STEP 0
--     8. Products count matches STEP 0
--
--   COMMIT;    -- if everything is correct
--   ROLLBACK;  -- if anything is wrong
-- ============================================================================
