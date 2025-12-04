# 🤖 Gemini AI & Rate Limiting Setup

## ✅ Implementation Status

Both features are **fully implemented** in the codebase. You just need to add the environment variables to Railway.

---

## 🤖 Gemini AI Setup

### Current Status
- ✅ Code fully implemented (`services/api/src/ai/gemini.service.ts`)
- ✅ AI Chat Service ready
- ✅ Personalization Service ready
- ✅ All AI features integrated
- ⚠️ Needs: API key in Railway

### Your API Key
```
AIzaSyBeXmjbXXyDRQHqu_9zpcBLrn2kxvDddeY
```

### Add to Railway

1. **Go to Railway Dashboard**
   - Railway Dashboard → `@hos-marketplace/api` service
   - Click **Variables** tab

2. **Add Gemini API Key**
   - Click **"+ New Variable"**
   - **Key:** `GEMINI_API_KEY`
   - **Value:** `AIzaSyBeXmjbXXyDRQHqu_9zpcBLrn2kxvDddeY`
   - Click **Add**

3. **Verify**
   - Railway will auto-redeploy
   - Check logs for: No warnings about missing API key

### What Gemini AI Enables

- ✅ **AI Chat** - Character-based conversations
- ✅ **Product Recommendations** - AI-powered suggestions
- ✅ **User Behavior Analysis** - Personalized insights
- ✅ **Personalized Content** - Dynamic content generation

### API Endpoints Available

- `POST /api/ai/chat` - Chat with AI characters
- `GET /api/ai/recommendations` - Get AI recommendations
- `GET /api/ai/personalization` - Get personalized content

---

## 🛡️ Rate Limiting Setup

### Current Status
- ✅ Code fully implemented (`services/api/src/rate-limit/rate-limit.module.ts`)
- ✅ Global rate limiting enabled
- ✅ Configurable via environment variables
- ⚠️ Currently using defaults (can be customized)

### Current Configuration (Defaults)

- **TTL:** 60000ms (1 minute)
- **Limit:** 100 requests per minute
- **Scope:** Global (all endpoints)

### Add to Railway (Optional - Has Defaults)

If you want to customize rate limits:

1. **Go to Railway Dashboard**
   - Railway Dashboard → `@hos-marketplace/api` service
   - Click **Variables** tab

2. **Add Rate Limit Variables** (Optional)

   **Variable 1:**
   - **Key:** `RATE_LIMIT_TTL`
   - **Value:** `60000` (milliseconds - 1 minute)
   - Click **Add**

   **Variable 2:**
   - **Key:** `RATE_LIMIT_MAX`
   - **Value:** `100` (requests per TTL period)
   - Click **Add**

### Rate Limiting Behavior

**Default Settings:**
- 100 requests per minute per IP
- Applies to all endpoints
- Returns `429 Too Many Requests` when exceeded

**Customization Examples:**

**Stricter (50 requests/minute):**
```env
RATE_LIMIT_TTL=60000
RATE_LIMIT_MAX=50
```

**More Lenient (200 requests/minute):**
```env
RATE_LIMIT_TTL=60000
RATE_LIMIT_MAX=200
```

**Per Hour (1000 requests/hour):**
```env
RATE_LIMIT_TTL=3600000
RATE_LIMIT_MAX=1000
```

### Rate Limiting Features

- ✅ **Automatic** - No code changes needed
- ✅ **IP-based** - Per client IP address
- ✅ **Configurable** - Via environment variables
- ✅ **Global** - Applies to all routes
- ✅ **Error Handling** - Returns proper HTTP 429 status

---

## 📋 Quick Setup Checklist

### Gemini AI (Required)
- [ ] Add `GEMINI_API_KEY` to Railway
- [ ] Value: `AIzaSyBeXmjbXXyDRQHqu_9zpcBLrn2kxvDddeY`
- [ ] Wait for redeployment
- [ ] Test AI chat endpoint

### Rate Limiting (Optional - Has Defaults)
- [ ] (Optional) Add `RATE_LIMIT_TTL` if you want to customize
- [ ] (Optional) Add `RATE_LIMIT_MAX` if you want to customize
- [ ] Defaults are already working (100 req/min)

---

## 🧪 Testing

### Test Gemini AI

**Test Chat Endpoint:**
```bash
curl -X POST https://your-api-url.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "characterId": "character-id",
    "message": "Hello, what products do you recommend?"
  }'
```

**Expected Response:**
```json
{
  "response": "AI-generated response...",
  "recommendations": [...]
}
```

### Test Rate Limiting

**Make Multiple Requests:**
```bash
# Make 101 requests rapidly
for i in {1..101}; do
  curl https://your-api-url.railway.app/api/products
done
```

**Expected:**
- First 100 requests: `200 OK`
- 101st request: `429 Too Many Requests`

---

## 📊 Environment Variables Summary

### Required (Gemini AI)
```env
GEMINI_API_KEY=AIzaSyBeXmjbXXyDRQHqu_9zpcBLrn2kxvDddeY
```

### Optional (Rate Limiting - Has Defaults)
```env
RATE_LIMIT_TTL=60000    # Default: 60000 (1 minute)
RATE_LIMIT_MAX=100      # Default: 100 requests
```

---

## ✅ Verification

### Check Railway Logs

After adding variables, check logs:

**Gemini AI:**
- No warnings about missing API key
- AI chat requests should work

**Rate Limiting:**
- Already working with defaults
- No configuration needed unless customizing

---

## 🎯 What's Enabled

### With Gemini AI:
- ✅ AI-powered character chat
- ✅ Intelligent product recommendations
- ✅ User behavior analysis
- ✅ Personalized content generation

### With Rate Limiting:
- ✅ Protection against abuse
- ✅ DDoS mitigation
- ✅ Fair resource usage
- ✅ API stability

---

## 📝 Notes

1. **Gemini API Key:** Keep it secure, don't commit to git
2. **Rate Limiting:** Defaults are production-ready (100 req/min)
3. **Customization:** Only add rate limit variables if you need different limits
4. **Testing:** Test AI features after adding the API key

---

**Last Updated:** December 3, 2025  
**Status:** Ready to configure - just add variables!

