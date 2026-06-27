# Create Product - zsh-Safe Command

## Quick Command (Copy-Paste Ready)

```bash
TOKEN="[jwt-redacted]"

curl -s -X POST http://localhost:3001/api/v1/admin/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Wand","description":"A test wand for inventory management testing","price":29.99,"currency":"GBP","stock":100,"sku":"WAND-001","status":"ACTIVE","fandom":"Harry Potter","isPlatformOwned":true,"images":[]}' | jq '.'
```

---

## Alternative: One Line (No Newlines)

```bash
TOKEN="[jwt-redacted]" && curl -s -X POST http://localhost:3001/api/v1/admin/products -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Test Wand","description":"A test wand for inventory testing","price":29.99,"currency":"GBP","stock":100,"sku":"WAND-001","status":"ACTIVE","fandom":"Harry Potter","isPlatformOwned":true,"images":[]}' | jq '.'
```

---

## Fix for zsh "event not found" Error

The error happens when zsh tries to expand history. Disable it for this command:

```bash
# Method 1: Disable history expansion temporarily
set +H
TOKEN="[jwt-redacted]"

curl -s -X POST http://localhost:3001/api/v1/admin/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Wand","description":"A test wand for inventory testing","price":29.99,"currency":"GBP","stock":100,"sku":"WAND-001","status":"ACTIVE","fandom":"Harry Potter","isPlatformOwned":true,"images":[]}' | jq '.'

# Re-enable history expansion
set -H
```

---

## Best: Use Single Line JSON (No Issues)

```bash
TOKEN="[jwt-redacted]"
curl -s -X POST http://localhost:3001/api/v1/admin/products -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Test Wand","description":"A test wand for inventory testing","price":29.99,"currency":"GBP","stock":100,"sku":"WAND-001","status":"ACTIVE","fandom":"Harry Potter","isPlatformOwned":true,"images":[]}' | jq '.'
```
