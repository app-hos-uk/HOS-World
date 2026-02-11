#!/usr/bin/env bash
# Redeploy the gateway service on Railway so it picks up the latest code
# (e.g. /api/health/circuits). Requires Railway CLI and project link.
#
# Usage: ./scripts/redeploy-gateway.sh
# Or:    railway link --service gateway-service && railway up --detach

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v railway &> /dev/null; then
  echo "Railway CLI not found. Install: npm install -g @railway/cli"
  echo "Then: railway login"
  exit 1
fi

echo "=============================================="
echo "Redeploying Gateway (gateway-service)"
echo "=============================================="
echo "Commit: $(git log -1 --oneline)"
echo ""

echo "Linking to gateway-service..."
railway link --service gateway-service 2>/dev/null || {
  echo "Could not link. Try: railway link (select project and gateway-service)"
  echo "Or in Railway Dashboard: gateway-service → Deployments → Redeploy"
  exit 1
}

echo "Triggering deploy (railway up --detach)..."
railway up --detach

echo ""
echo "✅ Gateway deploy triggered. Wait 2–5 min then check:"
echo "   curl -s https://gateway-service-production-df92.up.railway.app/api/health/circuits"
echo ""
