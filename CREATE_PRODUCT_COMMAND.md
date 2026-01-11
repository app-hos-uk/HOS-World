# Create Product - zsh-Safe Command

## Quick Command (Copy-Paste Ready)

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiZTQ3MzA3YS0yYWZjLTRkODMtYjQ0YS1iYTQ3M2YwOTQ1OGIiLCJlbWFpbCI6ImFwcEBob3VzZW9mc3BlbGxzLmNvLnVrIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzY3OTg5NDQ0LCJleHAiOjE3Njc5OTAzNDR9.SG1dSBMfm9fFV5MZwqY8dNKiplV1NVR3S1laeMZqN80"

curl -s -X POST http://localhost:3001/api/v1/admin/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Wand","description":"A test wand for inventory management testing","price":29.99,"currency":"GBP","stock":100,"sku":"WAND-001","status":"ACTIVE","fandom":"Harry Potter","isPlatformOwned":true,"images":[]}' | jq '.'
```

---

## Alternative: One Line (No Newlines)

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiZTQ3MzA3YS0yYWZjLTRkODMtYjQ0YS1iYTQ3M2YwOTQ1OGIiLCJlbWFpbCI6ImFwcEBob3VzZW9mc3BlbGxzLmNvLnVrIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzY3OTg5NDQ0LCJleHAiOjE3Njc5OTAzNDR9.SG1dSBMfm9fFV5MZwqY8dNKiplV1NVR3S1laeMZqN80" && curl -s -X POST http://localhost:3001/api/v1/admin/products -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Test Wand","description":"A test wand for inventory testing","price":29.99,"currency":"GBP","stock":100,"sku":"WAND-001","status":"ACTIVE","fandom":"Harry Potter","isPlatformOwned":true,"images":[]}' | jq '.'
```

---

## Fix for zsh "event not found" Error

The error happens when zsh tries to expand history. Disable it for this command:

```bash
# Method 1: Disable history expansion temporarily
set +H
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiZTQ3MzA3YS0yYWZjLTRkODMtYjQ0YS1iYTQ3M2YwOTQ1OGIiLCJlbWFpbCI6ImFwcEBob3VzZW9mc3BlbGxzLmNvLnVrIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzY3OTg5NDQ0LCJleHAiOjE3Njc5OTAzNDR9.SG1dSBMfm9fFV5MZwqY8dNKiplV1NVR3S1laeMZqN80"

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
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiZTQ3MzA3YS0yYWZjLTRkODMtYjQ0YS1iYTQ3M2YwOTQ1OGIiLCJlbWFpbCI6ImFwcEBob3VzZW9mc3BlbGxzLmNvLnVrIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzY3OTg5NDQ0LCJleHAiOjE3Njc5OTAzNDR9.SG1dSBMfm9fFV5MZwqY8dNKiplV1NVR3S1laeMZqN80"
curl -s -X POST http://localhost:3001/api/v1/admin/products -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Test Wand","description":"A test wand for inventory testing","price":29.99,"currency":"GBP","stock":100,"sku":"WAND-001","status":"ACTIVE","fandom":"Harry Potter","isPlatformOwned":true,"images":[]}' | jq '.'
```
