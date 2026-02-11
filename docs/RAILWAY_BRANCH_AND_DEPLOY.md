# Railway: Branch configuration and deploying

## Why pushes didn’t trigger a deployment

Railway only auto-deploys when you push to the **branch that is set in the Dashboard** for each service (often `main` or `master`). Your push was to `feat/phase-1-notifications`, so no deployment ran if the API service was still set to another branch.

---

## 1. Set the branch so pushes trigger deployments

The branch is configured in the **Railway Dashboard**, not in the CLI:

1. Open **[Railway Dashboard](https://railway.app/dashboard)**.
2. Select the project **HOS-World Production Deployment**.
3. Select the **@hos-marketplace/api** service (the API that runs `services/api`).
4. Go to **Settings** (or the **Source** / **Connect** tab).
5. Under **Source** / **Repository**:
   - Ensure the repo is connected (e.g. `app-hos-uk/HOS-World`).
   - Set **Branch** to `feat/phase-1-notifications` (or whichever branch you use for deploys).
   - Save.

After this, **every push to `feat/phase-1-notifications`** will trigger a new build and deployment for that service.

To have **multiple services** (e.g. web, gateway) deploy from the same branch, repeat the steps for each service and set the same branch.

---

## 2. Deploy now from the CLI (without changing branch)

To deploy the **current local code** (including uncommitted changes) without relying on GitHub:

```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu"
railway status                    # confirm project + service (e.g. @hos-marketplace/api)
railway up --detach               # trigger deploy; returns when upload is done
```

- **Project:** HOS-World Production Deployment  
- **Service:** @hos-marketplace/api (already linked in your setup)

Build logs: Railway will print a URL like  
`https://railway.com/project/.../service/...?id=...`  
Open it to watch the build and deployment.

---

## 3. Link a different service (e.g. API)

If you need to link another service (e.g. after cloning or a new project):

```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu"
railway link                     # pick project + service interactively
# or
railway link --service "@hos-marketplace/api"
railway status
railway up --detach
```

---

## 4. Summary

| Goal | Action |
|------|--------|
| **Pushes to `feat/phase-1-notifications` trigger deploy** | Dashboard → @hos-marketplace/api → Settings → Source → Branch = `feat/phase-1-notifications` |
| **Deploy current local code now** | `railway up --detach` from repo root (with API service linked) |
| **Check current link** | `railway status` |
