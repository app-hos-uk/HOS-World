# Fix: API service "couldn't locate dockerfile at path services/api/Dockerfile"

## Cause

The API service is built with **Root Directory** set to `services/api`. That makes Railway send only the contents of that folder as the build archive. There is then no path `services/api/Dockerfile` in the archive (the archive root is already inside `services/api`), so the build fails.

The Dockerfile at `services/api/Dockerfile` is written for **repo root** as build context (it does `COPY package.json`, `COPY packages`, `COPY services/api`). So the API service must use **repo root** as build context, not `services/api`.

---

## Fix in Railway Dashboard

### 1. Open API service settings

1. Go to **https://railway.app** → your project.
2. Open the **API** service (e.g. `@hos-marketplace/api`).

### 2. Source tab

**Settings → Source**

- **Root Directory:** leave **empty** (so the whole repo is used, not only `services/api`).
- Save if you change it.

### 3. Build tab

**Settings → Build**

Set:

| Setting            | Value                      |
|--------------------|----------------------------|
| **Builder**        | `Dockerfile`               |
| **Root Directory** | **empty** (repo root)      |
| **Dockerfile Path**| `services/api/Dockerfile`  |

So:

- Root Directory = empty → build context = repo root → path `services/api/Dockerfile` exists and COPYs in the Dockerfile work.
- Dockerfile Path = `services/api/Dockerfile` → Railway uses that file for the build.

Save the settings.

### 4. Redeploy

**Deployments** → **Redeploy** (or **Deploy**) so a new build runs with the updated config.

---

## Summary

- **Root Directory:** empty (repo root).
- **Dockerfile Path:** `services/api/Dockerfile`.

After this, the "couldn't locate the dockerfile at path services/api/Dockerfile" error should be resolved.
