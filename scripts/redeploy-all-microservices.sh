#!/usr/bin/env bash
# Redeploy all microservices (and optionally API/Web) on Railway.
# Requires Railway CLI and project linked. Run from repo root.
#
# Usage: ./scripts/redeploy-all-microservices.sh
# To redeploy only gateway: ./scripts/redeploy-gateway.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v railway &> /dev/null; then
  echo "Railway CLI not found. Install: npm install -g @railway/cli"
  exit 1
fi

# Service names as in Railway (from RAILWAY_MICROSERVICES_DEPLOYMENT.md)
SERVICES=(
  gateway-service
  auth-service
  notification-service
  search-service
  user-service
  product-service
  order-service
  payment-service
  inventory-service
  seller-service
  influencer-service
  content-service
  admin-service
)

echo "=============================================="
echo "Redeploying all microservices"
echo "=============================================="
echo "Commit: $(git log -1 --oneline)"
echo ""

for svc in "${SERVICES[@]}"; do
  echo "--- $svc ---"
  if railway link --service "$svc" 2>/dev/null; then
    railway up --detach
    echo "✅ $svc deploy triggered"
  else
    echo "⚠️  Skip $svc (link failed; redeploy from Dashboard if needed)"
  fi
  echo ""
  sleep 1
done

echo "=============================================="
echo "All service deploys triggered."
echo "Wait a few minutes, then check gateway:"
echo "  curl -s https://gateway-service-production-df92.up.railway.app/api/health/circuits"
echo "=============================================="
