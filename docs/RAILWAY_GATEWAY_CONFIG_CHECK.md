# Railway gateway-service – configuration check (CLI)

Summary of what was checked with `railway` CLI (project: **HOS-World Production Deployment**, service: **gateway-service**).

---

## 1. Status

| Item | Value |
|------|--------|
| **Project** | HOS-World Production Deployment |
| **Environment** | production |
| **Service** | gateway-service |
| **Latest deployment** | `fa8449f7` – **FAILED** (reason: redeploy) |
| **Current live** | Previous deployment `172efba1` – **SUCCESS** (2026-02-10 23:11:37) |

Because the latest deployment failed, the running app is the **old** build (no `/api/health/circuits`).

---

## 2. Variables (gateway-service)

| Variable | Value |
|---------|--------|
| **RAILWAY_DOCKERFILE_PATH** | `services/gateway/Dockerfile` ✅ |
| **JWT_SECRET** | Linked from payment-service ✅ |
| **RAILWAY_PUBLIC_DOMAIN** | gateway-service-production-df92.up.railway.app ✅ |
| **RAILWAY_PRIVATE_DOMAIN** | gateway-service.railway.internal |

No `GITHUB_*` or repo/source variables are shown – **source (GitHub repo/branch) is configured in the Railway Dashboard only**, not via CLI.

---

## 3. Repo / source not connected

If **gateway-service** has no GitHub (or other) source connected:

- Pushes to GitHub **will not** trigger builds for this service.
- You can still deploy from your **local** code using the CLI.

**Connect a repo (Dashboard):**

1. Open [Railway Dashboard](https://railway.app/dashboard) → project **HOS-World Production Deployment**.
2. Select **gateway-service**.
3. Go to **Settings** (or **Source**).
4. Under **Source**, connect your GitHub repo (e.g. `app-hos-uk/HOS-World`).
5. Set **Branch** to **`master`**.
6. Set **Root Directory** to empty (build context = repo root).
7. **Dockerfile path** is already set via variable: `services/gateway/Dockerfile`.

After this, pushes to the chosen branch will trigger builds.

---

## 4. Deploy from local (no repo needed)

To deploy the **current** code (including `/api/health/circuits`) without connecting a repo:

```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu"
railway link --service gateway-service   # if not already linked
railway up --detach
```

This uploads the project from your machine and builds with `services/gateway/Dockerfile`. Wait 3–5 minutes, then:

```bash
curl -s https://gateway-service-production-df92.up.railway.app/api/health/circuits
```

---

## 5. Commands used for this check

```bash
railway whoami
railway status
railway link --service gateway-service
railway service status
railway variable
railway deployment list --limit 3
railway deployment list --json
railway logs
```

---

## 6. Summary

| Config | Status |
|--------|--------|
| Project / environment | ✅ Linked (HOS-World Production Deployment, production) |
| RAILWAY_DOCKERFILE_PATH | ✅ services/gateway/Dockerfile |
| JWT_SECRET | ✅ Set (linked) |
| Public domain | ✅ gateway-service-production-df92.up.railway.app |
| GitHub/source | ❌ Not connected (set in Dashboard if you want deploy-on-push) |
| Latest deploy | ❌ FAILED – live is previous SUCCESS (old code) |

**Next step:** Connect the repo in the Dashboard **or** deploy once from CLI with `railway up --detach` from the repo root.

---

## 7. Deploy triggered from CLI

A deploy was triggered from local code so the gateway gets `/api/health/circuits` without needing GitHub connected:

- **Build logs:** [Railway build](https://railway.com/project/26dc565d-51d1-4050-8fd1-87c5714eb947/service/2aaa2fb3-c4e2-44bf-be55-f357101367e6)
- Wait **3–5 minutes**, then: `curl -s https://gateway-service-production-df92.up.railway.app/api/health/circuits`
