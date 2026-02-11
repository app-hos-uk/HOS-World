#!/usr/bin/env bash
# List Railway service names that exist in the linked project.
# Use this to find the exact API service name for railway variable delete -s <NAME>.
# Requires: railway CLI, logged in, project linked.

echo "Checking which Railway service names exist (variable list -s <name>)..."
echo ""

# Candidates that might be your monolith API or other services
CANDIDATES=(
  api
  api-service
  gateway-service
  search-service
  auth-service
  user-service
  hos-marketplaceapi
  hos-marketplace-api
  "HOS Marketplace API"
  monolith
  backend
  api-backend
)

for name in "${CANDIDATES[@]}"; do
  out=$(railway variable list -s "$name" 2>&1)
  if echo "$out" | grep -q "Service .* not found"; then
    echo "  (not found): $name"
  else
    echo "  EXISTS: $name"
  fi
done

echo ""
echo "Use an EXISTS name with: railway variable delete ELASTICSEARCH_NODE -s <NAME>"
echo "Or: ./scripts/railway-remove-elasticsearch-vars.sh search-service <API_SERVICE_NAME>"
