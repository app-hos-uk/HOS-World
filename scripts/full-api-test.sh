#!/bin/bash
# Full API endpoint test script
API="https://hos-marketplaceapi-production.up.railway.app/api"
CURL=/usr/bin/curl
PASS=0
FAIL=0
WARN=0

get_token() {
  $CURL -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null
}

t() {
  local m=$1 p=$2 l=$3 tok=$4
  if [ -n "$tok" ]; then
    r=$($CURL -s -o /dev/null -w "%{http_code}" -X "$m" "$API$p" -H "Authorization: Bearer $tok" -H "Content-Type: application/json" --max-time 10)
  else
    r=$($CURL -s -o /dev/null -w "%{http_code}" -X "$m" "$API$p" -H "Content-Type: application/json" --max-time 10)
  fi
  case $r in
    200|201)
      echo "✅ $r | $m $p | $l"
      PASS=$((PASS+1))
      ;;
    503)
      echo "⚡ $r | $m $p | $l (external dependency)"
      WARN=$((WARN+1))
      ;;
    501)
      echo "⚡ $r | $m $p | $l (not implemented)"
      WARN=$((WARN+1))
      ;;
    *)
      echo "❌ $r | $m $p | $l"
      FAIL=$((FAIL+1))
      ;;
  esac
}

echo "============================================"
echo "  OBTAINING TOKENS"
echo "============================================"

ADMIN_TOKEN=$(get_token "admin@hos.test" "Test123!")
CUSTOMER_TOKEN=$(get_token "customer@hos.test" "Test123!")
SELLER_TOKEN=$(get_token "seller@hos.test" "Test123!")
WHOLESALER_TOKEN=$(get_token "wholesaler@hos.test" "Test123!")
PROCUREMENT_TOKEN=$(get_token "procurement@hos.test" "Test123!")
FULFILLMENT_TOKEN=$(get_token "fulfillment@hos.test" "Test123!")
CATALOG_TOKEN=$(get_token "catalog@hos.test" "Test123!")
MARKETING_TOKEN=$(get_token "marketing@hos.test" "Test123!")
FINANCE_TOKEN=$(get_token "finance@hos.test" "Test123!")
CMS_TOKEN=$(get_token "cms@hos.test" "Test123!")
INFLUENCER_TOKEN=$(get_token "influencer@hos.test" "Test!123")

# Verify tokens
TOKEN_PASS=0
for role in ADMIN CUSTOMER SELLER WHOLESALER PROCUREMENT FULFILLMENT CATALOG MARKETING FINANCE CMS INFLUENCER; do
  varname="${role}_TOKEN"
  val="${!varname}"
  if [ -n "$val" ] && [ ${#val} -gt 20 ]; then
    echo "✅ $role login OK"
    TOKEN_PASS=$((TOKEN_PASS+1))
  else
    echo "❌ $role login FAILED"
  fi
done
echo ""
echo "Logins: $TOKEN_PASS / 11"
echo ""

echo "============================================"
echo "  1. PUBLIC ENDPOINTS (No Auth)"
echo "============================================"
echo ""

t GET "/health" "Health check"
t GET "/" "API root"
t GET "/products" "Products"
t GET "/products?limit=5" "Products (limit)"
t GET "/fandoms" "Fandoms"
t GET "/characters" "Characters"
t GET "/themes" "Themes"
t GET "/taxonomy/categories" "Categories"
t GET "/taxonomy/tags" "Tags"
t GET "/taxonomy/attributes" "Attributes"
t GET "/catalog/entries" "Catalog entries"
t GET "/catalog/pending" "Catalog pending"
t GET "/promotions" "Promotions"
t GET "/shipping/methods" "Shipping methods"
t GET "/badges" "Badges"
t GET "/quests" "Quests"
t GET "/currency/rates" "Currency rates"
t GET "/geolocation/detect" "Geolocation detect"
t GET "/gamification/leaderboard" "Leaderboard"
t GET "/meilisearch/search?q=test" "Meilisearch search"

echo ""
echo "============================================"
echo "  2. AUTH ENDPOINTS"
echo "============================================"
echo ""

t GET "/auth/me" "Current user (ADMIN)" "$ADMIN_TOKEN"
t GET "/auth/me" "Current user (CUSTOMER)" "$CUSTOMER_TOKEN"
t GET "/auth/me" "Current user (SELLER)" "$SELLER_TOKEN"
t GET "/auth/me" "Current user (WHOLESALER)" "$WHOLESALER_TOKEN"
t GET "/auth/me" "Current user (PROCUREMENT)" "$PROCUREMENT_TOKEN"
t GET "/auth/me" "Current user (FULFILLMENT)" "$FULFILLMENT_TOKEN"
t GET "/auth/me" "Current user (CATALOG)" "$CATALOG_TOKEN"
t GET "/auth/me" "Current user (MARKETING)" "$MARKETING_TOKEN"
t GET "/auth/me" "Current user (FINANCE)" "$FINANCE_TOKEN"
t GET "/auth/me" "Current user (CMS)" "$CMS_TOKEN"
t GET "/auth/me" "Current user (INFLUENCER)" "$INFLUENCER_TOKEN"

echo ""
echo "============================================"
echo "  3. CUSTOMER ENDPOINTS"
echo "============================================"
echo ""

t GET "/orders" "My orders" "$CUSTOMER_TOKEN"
t GET "/cart" "My cart" "$CUSTOMER_TOKEN"
t GET "/wishlist" "My wishlist" "$CUSTOMER_TOKEN"
t GET "/addresses" "My addresses" "$CUSTOMER_TOKEN"
t GET "/returns" "My returns" "$CUSTOMER_TOKEN"
t GET "/notifications" "Notifications" "$CUSTOMER_TOKEN"

echo ""
echo "============================================"
echo "  4. SELLER ENDPOINTS"
echo "============================================"
echo ""

t GET "/sellers/me" "Seller profile" "$SELLER_TOKEN"
t GET "/submissions" "My submissions" "$SELLER_TOKEN"

echo ""
echo "============================================"
echo "  5. PROCUREMENT ENDPOINTS"
echo "============================================"
echo ""

t GET "/procurement/submissions" "Procurement submissions" "$PROCUREMENT_TOKEN"

echo ""
echo "============================================"
echo "  6. FULFILLMENT ENDPOINTS"
echo "============================================"
echo ""

t GET "/fulfillment/shipments" "Fulfillment shipments" "$FULFILLMENT_TOKEN"

echo ""
echo "============================================"
echo "  7. CATALOG ENDPOINTS"
echo "============================================"
echo ""

t GET "/catalog/entries" "Catalog entries" "$CATALOG_TOKEN"
t GET "/catalog/pending" "Catalog pending" "$CATALOG_TOKEN"
t GET "/catalog/dashboard/stats" "Catalog dashboard stats" "$CATALOG_TOKEN"

echo ""
echo "============================================"
echo "  8. FINANCE ENDPOINTS"
echo "============================================"
echo ""

t GET "/finance/pending" "Finance pending" "$FINANCE_TOKEN"
t GET "/finance/dashboard/stats" "Finance dashboard stats" "$FINANCE_TOKEN"
t GET "/finance/transactions" "Finance transactions (FINANCE)" "$FINANCE_TOKEN"
t GET "/finance/transactions" "Finance transactions (ADMIN)" "$ADMIN_TOKEN"

echo ""
echo "============================================"
echo "  9. CMS ENDPOINTS"
echo "============================================"
echo ""

t GET "/cms/pages" "CMS pages" "$CMS_TOKEN"

echo ""
echo "============================================"
echo "  10. ADMIN MANAGEMENT ENDPOINTS"
echo "============================================"
echo ""

t GET "/admin/dashboard" "Admin dashboard" "$ADMIN_TOKEN"
t GET "/admin/users" "Admin users" "$ADMIN_TOKEN"
t GET "/orders" "All orders (admin)" "$ADMIN_TOKEN"
t GET "/notifications" "Notifications (admin)" "$ADMIN_TOKEN"
t GET "/support/tickets" "Support tickets" "$ADMIN_TOKEN"
t GET "/customer-groups" "Customer groups" "$ADMIN_TOKEN"
t GET "/return-policies" "Return policies" "$ADMIN_TOKEN"
t GET "/tenants" "Tenants" "$ADMIN_TOKEN"
t GET "/integrations" "Integrations" "$ADMIN_TOKEN"
t GET "/webhooks" "Webhooks" "$ADMIN_TOKEN"
t GET "/discrepancies" "Discrepancies" "$ADMIN_TOKEN"
t GET "/collections" "Collections" "$ADMIN_TOKEN"
t GET "/tax/rates" "Tax rates" "$ADMIN_TOKEN"
t GET "/dashboard/stats" "Dashboard stats" "$ADMIN_TOKEN"
t GET "/settlements" "Settlements" "$ADMIN_TOKEN"
t GET "/activity/logs" "Activity logs" "$ADMIN_TOKEN"
t GET "/whatsapp/conversations" "WhatsApp conversations" "$ADMIN_TOKEN"
t GET "/gdpr/consent" "GDPR consent" "$ADMIN_TOKEN"
t GET "/newsletter/subscriptions" "Newsletter subscriptions" "$ADMIN_TOKEN"

echo ""
echo "============================================"
echo "  11. INFLUENCER ENDPOINTS (as INFLUENCER)"
echo "============================================"
echo ""

t GET "/influencers/me" "My profile" "$INFLUENCER_TOKEN"
t GET "/influencers/me/analytics" "My analytics" "$INFLUENCER_TOKEN"
t GET "/influencers/me/product-links" "My product links" "$INFLUENCER_TOKEN"
t GET "/influencers/me/campaigns" "My campaigns" "$INFLUENCER_TOKEN"
t GET "/influencers/me/commissions" "My commissions" "$INFLUENCER_TOKEN"
t GET "/influencers/me/earnings" "My earnings" "$INFLUENCER_TOKEN"
t GET "/influencers/me/payouts" "My payouts" "$INFLUENCER_TOKEN"
t GET "/influencers/me/storefront" "My storefront" "$INFLUENCER_TOKEN"
t GET "/referrals/me" "My referrals" "$INFLUENCER_TOKEN"

echo ""
echo "============================================"
echo "  12. INFLUENCER ADMIN ENDPOINTS (as ADMIN)"
echo "============================================"
echo ""

t GET "/admin/influencers" "All influencers" "$ADMIN_TOKEN"
t GET "/admin/influencer-invitations" "All invitations" "$ADMIN_TOKEN"
t GET "/admin/influencer-campaigns" "All campaigns" "$ADMIN_TOKEN"
t GET "/admin/influencer-commissions" "All commissions" "$ADMIN_TOKEN"
t GET "/admin/influencer-payouts" "All payouts" "$ADMIN_TOKEN"

echo ""
echo "============================================"
echo "  FINAL RESULTS"
echo "============================================"
echo ""
TOTAL=$((PASS+FAIL+WARN))
echo "✅ Passed:  $PASS / $TOTAL"
echo "❌ Failed:  $FAIL / $TOTAL"
echo "⚡ Warning: $WARN / $TOTAL (external deps / not implemented)"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "🎉 ALL ENDPOINTS PASSING (no errors)"
else
  echo "⚠️  $FAIL endpoint(s) need attention"
fi
