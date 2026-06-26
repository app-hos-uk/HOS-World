#!/usr/bin/env bash
# Interactive Stripe live setup — run from repo root or services/api
# Requires: Railway CLI linked to @hos-marketplace/api, Stripe live keys from dashboard

set -euo pipefail

echo ""
echo "=============================================="
echo "  Stripe Live Mode Setup for HOS"
echo "=============================================="
echo ""
echo "STEP 1 — Stripe Dashboard (you are logged in)"
echo "  Open: https://dashboard.stripe.com/apikeys"
echo "  Copy Publishable key (pk_live_...) and Secret key (sk_live_...)"
echo ""
read -r -p "Paste Publishable key (pk_live_...): " STRIPE_PUBLISHABLE_KEY
read -r -s -p "Paste Secret key (sk_live_...): " STRIPE_SECRET_KEY
echo ""
read -r -p "Webhook secret (whsec_...) — leave blank to auto-create: " STRIPE_WEBHOOK_SECRET
echo ""

if [[ -z "$STRIPE_PUBLISHABLE_KEY" || -z "$STRIPE_SECRET_KEY" ]]; then
  echo "❌ Publishable and Secret keys are required."
  exit 1
fi

cd "$(dirname "$0")/../services/api" || cd services/api

export STRIPE_PUBLISHABLE_KEY
export STRIPE_SECRET_KEY
if [[ -n "$STRIPE_WEBHOOK_SECRET" ]]; then
  export STRIPE_WEBHOOK_SECRET
fi

echo ""
echo "Running setup against Railway production database..."
railway run -- pnpm exec ts-node scripts/setup-stripe-live.ts

echo ""
echo "Restarting API service to load Stripe credentials..."
railway service restart --service "@hos-marketplace/api" 2>/dev/null || railway redeploy --service "@hos-marketplace/api" 2>/dev/null || echo "Restart manually in Railway dashboard if needed."

echo ""
echo "Done. Verify:"
echo "  curl -s https://hos-marketplaceapi-production.up.railway.app/api/payments/config"
