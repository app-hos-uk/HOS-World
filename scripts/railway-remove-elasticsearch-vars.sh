#!/usr/bin/env bash
# Remove ELASTICSEARCH_* environment variables from Railway search and API services using the CLI.
# Requires: railway CLI installed and logged in (railway login), project linked (railway link).
#
# Usage:
#   ./scripts/railway-remove-elasticsearch-vars.sh
#   ./scripts/railway-remove-elasticsearch-vars.sh "search-service" "your-api-service-name"
#
# If "Service 'api' not found": find your API service name by running:
#   ./scripts/railway-list-service-names.sh
#   Then run this script with the EXISTS name, e.g.:
#   ./scripts/railway-remove-elasticsearch-vars.sh "search-service" "your-actual-api-service-name"

set -e

# Default service names (override with args; API name varies by project, e.g. hos-marketplaceapi)
SEARCH_SERVICE="${1:-search-service}"
API_SERVICE="${2:-api}"

# Known ELASTICSEARCH_* variable names (delete these if present)
ELASTIC_VARS="ELASTICSEARCH_NODE ELASTICSEARCH_USERNAME ELASTICSEARCH_PASSWORD ELASTICSEARCH_SNIFF_ON_START"

delete_elastic_vars_for_service() {
  local service="$1"
  echo "Service: $service"
  local not_found=0
  for key in $ELASTIC_VARS; do
    out=$(railway variable delete "$key" -s "$service" 2>&1) || true
    if echo "$out" | grep -q "Deleted variable"; then
      echo "  Deleted: $key"
    elif echo "$out" | grep -q "not found"; then
      not_found=1
      echo "  Service '$service' not found. Use Railway Dashboard → project → Services for the exact API service name."
      echo "  Then: ./scripts/railway-remove-elasticsearch-vars.sh \"$SEARCH_SERVICE\" \"<your-api-service-name>\""
      break
    else
      echo "  Skip (not set or error): $key"
    fi
  done
  return $not_found
}

echo "Removing ELASTICSEARCH_* variables from Railway..."
echo ""

delete_elastic_vars_for_service "$SEARCH_SERVICE"
echo ""

delete_elastic_vars_for_service "$API_SERVICE"
echo ""

echo "Done."
