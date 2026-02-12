#!/usr/bin/env bash
# Set Railway service variables and paths via CLI (RAILWAY_DOCKERFILE_PATH, NODE_ENV).
# Source/repo and branch must be set in the Dashboard (see docs/RAILWAY_BRANCH_AND_DEPLOY.md).
# Requires: Railway CLI installed, logged in (railway login), project linked (railway link).
#
# Usage:
#   ./scripts/railway-set-service-vars.sh              # set Dockerfile path + NODE_ENV for all
#   ./scripts/railway-set-service-vars.sh --dry-run     # print commands only
#   ./scripts/railway-set-service-vars.sh gateway-service   # single service

set -e

DRY_RUN=""
SINGLE_SERVICE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -*)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
    *)
      SINGLE_SERVICE="$1"
      shift
      ;;
  esac
done

# Service name (Railway) and Dockerfile path: "service:path" per line
SERVICE_PATHS="gateway-service:services/gateway/Dockerfile
auth-service:services/auth/Dockerfile
user-service:services/user/Dockerfile
admin-service:services/admin/Dockerfile
order-service:services/order/Dockerfile
search-service:services/search/Dockerfile
seller-service:services/seller/Dockerfile
content-service:services/content/Dockerfile
payment-service:services/payment/Dockerfile
product-service:services/product/Dockerfile
inventory-service:services/inventory/Dockerfile
influencer-service:services/influencer/Dockerfile
notification-service:services/notification/Dockerfile"

cd "$(dirname "$0")/.."

if ! command -v railway &>/dev/null; then
  echo "Railway CLI not found. Install: npm install -g @railway/cli"
  echo "Then: railway login"
  exit 1
fi

if ! railway status &>/dev/null; then
  if [[ -z "$DRY_RUN" ]]; then
    echo "Project not linked. Run: railway link"
    exit 1
  fi
  echo "(Project not linked; showing commands only.)"
  echo ""
fi

set_vars_for_service() {
  local svc="$1"
  local path="$2"
  echo "Service: $svc"
  if [[ -n "$DRY_RUN" ]]; then
    echo "  railway variable set \"RAILWAY_DOCKERFILE_PATH=$path\" \"NODE_ENV=production\" -s \"$svc\""
    echo ""
    return 0
  fi
  if railway variable set "RAILWAY_DOCKERFILE_PATH=$path" "NODE_ENV=production" -s "$svc"; then
    echo "  OK"
  else
    echo "  Failed (service may not exist or name may differ; use Dashboard or 'railway link --service <name>' to confirm)"
  fi
  echo ""
}

echo "=== Railway: Set service variables via CLI ==="
proj=$(railway status 2>/dev/null | head -1 || true)
[[ -n "$proj" ]] && echo "$proj" && echo ""

if [[ -n "$SINGLE_SERVICE" ]]; then
  path=$(echo "$SERVICE_PATHS" | awk -v s="$SINGLE_SERVICE" -F: '$1==s {print $2; exit}')
  if [[ -z "$path" ]]; then
    echo "Unknown service: $SINGLE_SERVICE"
    echo "Valid: $(echo "$SERVICE_PATHS" | cut -d: -f1 | tr '\n' ' ')"
    exit 1
  fi
  set_vars_for_service "$SINGLE_SERVICE" "$path"
else
  echo "$SERVICE_PATHS" | while IFS=: read -r svc path; do
    [[ -n "$svc" && -n "$path" ]] && set_vars_for_service "$svc" "$path"
  done
fi

echo "Done. Source/branch still require Dashboard: Settings → Source → Connect Repo, Branch = master."
echo "Optional: set DATABASE_URL, JWT_SECRET, etc. per service: railway variable set KEY=value -s <service>"
