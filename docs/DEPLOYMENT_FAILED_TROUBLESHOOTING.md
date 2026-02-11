# Gateway deployment failed – troubleshooting

When a Railway deploy fails, the **build or deploy logs** are in the Dashboard (the CLI often doesn’t show the failure reason).

---

## 1. Get the failure reason

1. Open **[Railway Dashboard](https://railway.app/dashboard)** → project **HOS-World Production Deployment**.
2. Select **gateway-service**.
3. Open the **Deployments** tab and click the **failed** deployment.
4. Open **Build logs** and **Deploy logs** and check the last lines for the error.

---

## 2. Common causes and fixes

### Build stage

| Symptom | Likely cause | Fix |
|--------|----------------|-----|
| `pnpm install` fails | Lockfile or network | Ensure `pnpm-lock.yaml` is committed; retry. |
| `workspace not found` / `workspace:*` | Prod stage install before packages copied | Use a Dockerfile that copies built `packages/` (and `services/gateway/dist`) **before** `pnpm install --prod`. (Current gateway Dockerfile was updated to do this.) |
| `pnpm build` fails in a package | TypeScript or missing dep | Fix the package (e.g. `packages/shared-types`, `auth-common`, `observability`) and rebuild. |
| `nest build` fails in gateway | TS error or missing module | Fix under `services/gateway/src` and ensure CircuitBreakerService and HealthModule are correctly wired. |

### Deploy / runtime stage

| Symptom | Likely cause | Fix |
|--------|----------------|-----|
| Healthcheck failed | App not listening on `PORT` or slow start | Gateway uses `process.env.PORT || 4000`. Railway sets `PORT`. Ensure `railway.toml` has `healthcheckPath: "/api/health/live"` and `healthcheckTimeout: 120`. |
| Container exit 1 | Crash on startup (e.g. missing env) | Check **Deploy logs** for the first error. Set `JWT_SECRET` (and any required vars) in Railway variables. |
| 502 / unhealthy | App listens on wrong port | Gateway must listen on `process.env.PORT` (Railway injects it). |

---

## 3. Dockerfile change applied

The gateway **production** stage was updated so that:

1. **Built packages and dist are copied from the build stage before** `pnpm install --prod`, so `workspace:*` dependencies resolve.
2. **curl is installed** in the production image for healthchecks (same pattern as auth/notification).

If your last deploy was before this change, pull the latest and redeploy (or push and let Railway rebuild).

---

## 4. Redeploy after fixing

- **From CLI (deploy from local):**  
  `railway link --service gateway-service` then `railway up --detach`
- **From Dashboard:**  
  gateway-service → **Deployments** → **Redeploy** (or connect GitHub and push to trigger a new build).

After redeploying, wait 3–5 minutes and check:

```bash
curl -s https://gateway-service-production-df92.up.railway.app/api/health/live
curl -s https://gateway-service-production-df92.up.railway.app/api/health/circuits
```
