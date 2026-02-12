# Railway: Source (repo) and branch configuration

## Current state

- **Only API and web** are connected to a GitHub repo and have root/source configured in the Railway Dashboard.
- **All other services** (gateway, auth, user, admin, order, search, seller, content, payment, product, inventory, influencer, notification) are **not** connected to any repo—they show "Connect Source" / "Connect Repo" in Settings → Source. Deploys for those services today happen via CLI (`railway up`) or one-off builds, not from Git pushes.

To have **every push to `master`** trigger builds for all services, you need to **connect each service to the same repo**, then set **Branch** to **`master`**.

---

## 1. Services already connected (API, web)

For **API** and **web** only:

1. Open **[Railway Dashboard](https://railway.app/dashboard)** → project **HOS-World Production Deployment**.
2. Open the **API** service (e.g. hos-marketplaceapi) and **web** (e.g. hos-marketplaceweb).
3. **Settings** → **Source**: ensure **Branch** is **`master`**. Save if you change it.

---

## 2. Connect repo and set branch for all other services

For every other service (gateway, auth, user, admin, order, search, seller, content, payment, product, inventory, influencer, notification), do the following **once** in the Dashboard:

1. Open **[Railway Dashboard](https://railway.app/dashboard)** → project **HOS-World Production Deployment**.
2. Open the service (e.g. **auth-service**, **content-service**, **influencer-service**, etc.).
3. Go to **Settings** → **Source**.
4. Click **Connect Repo** (GitHub).
5. Select the same repo as API/web (e.g. **app-hos-uk/HOS-World**).
6. Set **Branch** to **`master`**.
7. **Root Directory:** leave **empty** or `/` (repo root). Each service’s Dockerfile is set via the **RAILWAY_DOCKERFILE_PATH** variable (e.g. `services/auth/Dockerfile`), not by root directory.
8. Save.

**“Skipping Dockerfile at services/…” in the log:** When Root Directory is empty, Railway’s scanner only treats the repo root as valid, so it reports “found Dockerfile at Dockerfile” (the root one) and “skipping … at services/xyz/Dockerfile as it is not rooted at a valid path”. That’s expected. Each microservice must have the **RAILWAY_DOCKERFILE_PATH** variable set in **Variables** (e.g. `services/auth/Dockerfile`, `services/gateway/Dockerfile`) so Railway uses the correct Dockerfile for that service. Build context stays the repo root; only the Dockerfile path changes per service.

Repeat for each of the services in the table below.

**Quick way:** From repo root, run `./scripts/railway-set-branch-master.sh` to open the project in the Dashboard and print a checklist.

**Set variables and paths via CLI:** Source/branch cannot be set via CLI; use the Dashboard for that. You can set **RAILWAY_DOCKERFILE_PATH** and **NODE_ENV** (and other variables) per service with the Railway CLI:

```bash
# From repo root (project already linked: railway link)
./scripts/railway-set-service-vars.sh              # all microservices
./scripts/railway-set-service-vars.sh --dry-run    # print commands only
./scripts/railway-set-service-vars.sh gateway-service   # single service
```

Or manually per service:

```bash
railway variable set "RAILWAY_DOCKERFILE_PATH=services/gateway/Dockerfile" "NODE_ENV=production" -s gateway-service
railway variable set "RAILWAY_DOCKERFILE_PATH=services/auth/Dockerfile" "NODE_ENV=production" -s auth-service
# ... etc. Use -s <service> for each Railway service name.
```

To set other variables (e.g. DATABASE_URL, JWT_SECRET) via CLI:

```bash
railway variable set "DATABASE_URL=postgresql://..." -s auth-service
railway variable set "JWT_SECRET=your-secret" -s gateway-service
railway variable list -s auth-service   # list variables for a service
```

### Services that need "Connect Repo" then Branch = `master`

For each service, set **Variables** → **RAILWAY_DOCKERFILE_PATH** to the path below (if not already set):

| Railway Service Name   | RAILWAY_DOCKERFILE_PATH           |
|------------------------|-----------------------------------|
| **gateway-service**     | `services/gateway/Dockerfile`     |
| **auth-service**       | `services/auth/Dockerfile`        |
| **user-service**       | `services/user/Dockerfile`        |
| **admin-service**      | `services/admin/Dockerfile`       |
| **order-service**      | `services/order/Dockerfile`       |
| **search-service**     | `services/search/Dockerfile`      |
| **seller-service**     | `services/seller/Dockerfile`      |
| **content-service**    | `services/content/Dockerfile`     |
| **payment-service**    | `services/payment/Dockerfile`     |
| **product-service**    | `services/product/Dockerfile`     |
| **inventory-service**  | `services/inventory/Dockerfile`   |
| **influencer-service** | `services/influencer/Dockerfile`  |
| **notification-service** | `services/notification/Dockerfile` |

### Already connected (only set Branch = `master` if needed)

| Railway Service Name   | Notes                    |
|------------------------|-------------------------|
| **api** / **hos-marketplaceapi** | Monolith API (`services/api`) |
| **web** / **hos-marketplaceweb** | Next.js frontend |

After every service has a connected repo and Branch = `master`, **pushes to `master`** will trigger builds for all of them.

---

## 2. Deploy now from the CLI (without changing branch)

To deploy the **current local code** (including uncommitted changes) without relying on GitHub:

```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu"
railway status                    # confirm project + service (e.g. @hos-marketplace/api)
railway up --detach               # trigger deploy; returns when upload is done
```

- **Project:** HOS-World Production Deployment  
- **Service:** Link with `railway link --service <name>` then run `railway up --detach`.

Build logs: Railway will print a URL; open it to watch the build and deployment.

---

## 3. Link a different service (e.g. API)

If you need to link another service (e.g. after cloning or a new project):

```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu"
railway link                     # pick project + service interactively
# or
railway link --service "gateway-service"
railway status
railway up --detach
```

---

## 4. Summary

| Goal | Action |
|------|--------|
| **Pushes to `master` trigger deploy** | Dashboard → each service → Settings → Source → Branch = **`master`** |
| **Open Dashboard to set branch** | `./scripts/railway-set-branch-master.sh` or `railway open` |
| **Set RAILWAY_DOCKERFILE_PATH / NODE_ENV** | `./scripts/railway-set-service-vars.sh` or `railway variable set KEY=value -s <service>` |
| **Set other variables (e.g. DATABASE_URL)** | `railway variable set "DATABASE_URL=..." -s <service>` |
| **Deploy current local code now** | `railway link --service <name>` then `railway up --detach` |
| **Check current link** | `railway status` |
