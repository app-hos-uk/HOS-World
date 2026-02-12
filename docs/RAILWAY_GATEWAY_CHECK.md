# Railway Gateway Service – How to Check

## Finding the HOS gateway URL

The HOS Marketplace API Gateway is deployed on Railway as **gateway-service** (see `MICROSERVICES_TRANSITION_VERIFICATION.md` and `RAILWAY_MICROSERVICES_DEPLOYMENT.md`). Its **public URL is not fixed** – it depends on your project and whether a domain was generated.

### Steps

1. Open **[Railway Dashboard](https://railway.app/dashboard)** and select the project (e.g. **HOS-World Production Deployment**).
2. Open the **gateway-service** (or similarly named gateway) service.
3. Go to **Settings → Networking** (or **Variables & Networking**).
4. Under **Public Networking**, check **Generate Domain** or the listed domain.  
   The URL will look like:  
   `https://gateway-service-production-df92.up.railway.app`  
   or a custom domain you attached.
5. Copy that base URL (no path).

**Current HOS gateway (production):**  
`https://gateway-service-production-df92.up.railway.app`

**Note:** The host **gateway-service-production.up.railway.app** (no `-df92`) was probed and returns `"Local Empire CRM Gateway"` – it is **not** the HOS Marketplace gateway.

---

## Connect gateway-service to GitHub (if not connected)

If **gateway-service** has no repo/source connected, pushes will not trigger builds. Connect it in the Dashboard:

1. Railway → **gateway-service** → **Settings** → **Source** (or **Connect Repo**).
2. Connect **GitHub** and select repo (e.g. `app-hos-uk/HOS-World`).
3. Set **Branch** to **`master`**.
4. **Root Directory:** leave empty (Dockerfile path is already `services/gateway/Dockerfile` via variable).

See **docs/RAILWAY_GATEWAY_CONFIG_CHECK.md** for a full CLI config check.

---

## Redeploy so `/api/health/circuits` is available

If you pushed the circuit-breaker commit but the gateway still returns 404 for `/api/health/circuits`:

1. **Connect repo** (if not done) – see “Connect gateway-service to GitHub” above.
2. **Check the branch**  
   Railway → **gateway-service** → **Settings** → **Source**. Ensure **Branch** is set to **`master`** so pushes to master trigger builds.

2. **Trigger a redeploy**
   - **Option A (CLI):** From repo root:
     ```bash
     ./scripts/redeploy-gateway.sh
     ```
     Or: `railway link --service gateway-service` then `railway up --detach`.
   - **Option B (Dashboard):** Railway → **gateway-service** → **Deployments** → **Redeploy** on the latest deployment (or **Deploy** to build from the current branch again).

3. **Redeploy all microservices:**  
   `./scripts/redeploy-all-microservices.sh`

4. Wait 2–5 minutes, then:
   ```bash
   curl -s https://gateway-service-production-df92.up.railway.app/api/health/circuits
   ```

---

## Checking gateway health (once you have the URL)

Set `GATEWAY_URL` to your gateway’s base URL, then run:

```bash
# Full gateway smoke test (health + /api/health/services + /api/health/circuits)
GATEWAY_URL=https://YOUR-GATEWAY-URL.up.railway.app node scripts/smoke-test-gateway.mjs

# Short load test
GATEWAY_URL=https://YOUR-GATEWAY-URL.up.railway.app node scripts/load-test-gateway.mjs 5 5
```

Expected for a healthy HOS gateway:

- **Root** `GET /` → 200, JSON with `"service": "gateway"` or similar.
- **Health** `GET /api/health`, `/api/health/live`, `/api/health/ready` → 200.
- **Services** `GET /api/health/services` → 200, JSON with `services` array.
- **Circuits** `GET /api/health/circuits` → 200, JSON with `circuits` object.

---

## If the gateway has no public domain

If the gateway is only used internally (e.g. frontend talks to monolith, or gateway is behind a single public API URL):

- You can still check it from **Railway’s shell** or from another service in the same project using the **internal hostname** (e.g. `http://gateway-service.railway.internal:4000`), if your plan supports it.
- Or generate a **temporary public domain** in Settings → Networking to run the smoke test, then remove it if you don’t need it.

---

## Summary

| What | Where |
|------|--------|
| Railway service name | **gateway-service** (or as in your project) |
| How to get URL | Dashboard → gateway-service → Settings → Networking → domain |
| Smoke test | `GATEWAY_URL=<url> node scripts/smoke-test-gateway.mjs` |
| Current HOS gateway URL | `https://gateway-service-production-df92.up.railway.app` |
| Probed URL that is **not** HOS | `gateway-service-production.up.railway.app` (different project) |
