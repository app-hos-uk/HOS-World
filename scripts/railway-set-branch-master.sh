#!/usr/bin/env bash
# Connect all Railway services to the repo and set branch to "master".
# Only API and web are currently connected; other services need "Connect Repo" first.
# Branch/source cannot be set via CLI; use the Dashboard.
# This script opens the project in the Dashboard and prints a checklist.
# Requires: Railway CLI installed and logged in (railway login), project linked (railway link).

set -e

echo "=== Railway: Connect repo + set branch to master for all services ==="
echo ""

if ! command -v railway &> /dev/null; then
  echo "Railway CLI not found. Install: npm install -g @railway/cli"
  echo "Then: railway login"
  exit 1
fi

cd "$(dirname "$0")/.."

# Ensure we're linked to the project (no specific service required for 'open')
if ! railway status &>/dev/null; then
  echo "Project not linked. Run: railway link"
  echo "Select project: HOS-World Production Deployment"
  exit 1
fi

echo "Project: $(railway status 2>/dev/null | head -1 || true)"
echo ""
echo "Only API and web are connected to the repo. All other services need:"
echo "  Settings → Source → Connect Repo → select app-hos-uk/HOS-World → Branch = master, Root = empty."
echo ""
echo "Opening Railway Dashboard..."
echo ""

# Open project in browser (user can then click each service)
railway open

echo ""
echo "--- Already connected (just set Branch = master if needed) ---"
echo "  [ ] api / hos-marketplaceapi"
echo "  [ ] web / hos-marketplaceweb"
echo ""
echo "--- Not connected: Connect Repo, then set Branch = master ---"
SERVICES=(
  "gateway-service"
  "auth-service"
  "user-service"
  "admin-service"
  "order-service"
  "search-service"
  "seller-service"
  "content-service"
  "payment-service"
  "product-service"
  "inventory-service"
  "influencer-service"
  "notification-service"
)
for svc in "${SERVICES[@]}"; do
  echo "  [ ] $svc"
done
echo "--- end checklist ---"
echo ""
echo "Done. After connecting repo and setting branch to master, pushes to master will trigger deploys."
