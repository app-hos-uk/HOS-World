# Ensure Deployments Use app@houseofspells.co.uk Railway Account

Deployments must run from the **Railway account** associated with **app@houseofspells.co.uk**. Follow these steps to confirm the correct account and trigger deploys.

---

## 1. Use the Correct Railway Account

- **Log in to Railway** with the account that uses **app@houseofspells.co.uk** (or the team/account that owns the HOS project).
- If you use the CLI, run:
  ```bash
  railway logout
  railway login
  ```
  Then sign in with **app@houseofspells.co.uk** (or the correct team).

- To see which account you’re using:
  ```bash
  railway whoami
  ```

---

## 2. Confirm Project Ownership

1. Go to **https://railway.app/dashboard**
2. Ensure you’re in the account for **app@houseofspells.co.uk**
3. Open the project that contains:
   - **@hos-marketplace/api** (or API service)
   - **@hos-marketplace/web** (or Web service)
   - **PostgreSQL**, **Redis**, etc.

If this project is under a different account, you need to use the account that owns it (app@houseofspells.co.uk) or transfer the project to that account in Railway.

---

## 3. Connect GitHub and Enable Auto-Deploy

For **both** API and Web services:

1. In Railway, open the project → select the service (**API** or **Web**).
2. Go to the **Source** tab.
3. Confirm:
   - **Repository:** `app-hos-uk/HOS-World` (or your actual repo).
   - **Branch:** `master`.
   - **Auto Deploy:** **ON** (so pushes to `master` trigger a deploy).
4. If the repo isn’t connected:
   - Click **Connect Repository** → choose the GitHub org/repo → select branch **master** → enable **Auto Deploy**.

Repeat for the other service (API and Web).

---

## 4. Trigger a Deployment After Push

If you just pushed (e.g. commit `991bd18`) and no deploy started:

**Option A – Redeploy from Dashboard**

1. Railway Dashboard → your project.
2. Open **@hos-marketplace/api** → **Deployments** → **Redeploy** (or **Deploy**).
3. Open **@hos-marketplace/web** → **Deployments** → **Redeploy** (or **Deploy**).

**Option B – CLI (must be logged in as app@houseofspells.co.uk account)**

```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu"

# Link to the project (if not already)
railway link
# Select the project under app@houseofspells.co.uk

# Redeploy API
railway service "@hos-marketplace/api"
railway redeploy --yes

# Redeploy Web
railway service "@hos-marketplace/web"
railway redeploy --yes
```

---

## 5. Verify Deployment

- **API:**  
  `https://hos-marketplaceapi-production.up.railway.app/api/health`
- **Web:**  
  `https://hos-marketplaceweb-production.up.railway.app`

Check **Deployments** in Railway for each service and confirm the latest commit (e.g. `991bd18`) is the one deployed.

---

## Summary Checklist

- [ ] Logged into Railway with **app@houseofspells.co.uk** (or the account that owns the HOS project)
- [ ] Project with API + Web is under that account
- [ ] GitHub repo `app-hos-uk/HOS-World` connected to **both** services, branch **master**
- [ ] **Auto Deploy** enabled for both services
- [ ] Triggered **Redeploy** for API and Web if the latest push did not deploy

After this, future pushes to `master` should deploy automatically from the app@houseofspells.co.uk Railway account.

---

## 6. GitHub Actions: `RAILWAY_TOKEN` (fix “Project Token not found”)

The Deploy workflow runs `railway up` and requires a **project deploy token** from **Project → Tokens** (not the separate “account” API token page unless docs say otherwise).

1. Open your **project** in Railway (the one that contains **api** and **web** services).
2. Go to **Project settings → Tokens**.
3. Click **New Token**, pick environment **production**, name it e.g. `github-actions`, then **Create**.
4. **Copy the full token immediately** — Railway shows it **once** under “We will only show this token once”. The value is often **UUID-shaped** (for example `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). Do **not** confuse it with:
   - the **project ID** (different UUID, from project settings),
   - a **leading `-`** pasted from a markdown bullet,
   - or the **masked** value in the table (only `****-xxxx` is visible later).
5. Set the GitHub secret (exact name **`RAILWAY_TOKEN`**):

   ```bash
   printf '%s' 'PASTE_FULL_TOKEN_HERE' | gh secret set RAILWAY_TOKEN -R app-hos-uk/HOS-World
   ```

6. Re-run **Actions → Deploy** or push to `master`.

If you previously saved the wrong value, create a **new** token in Railway and replace the secret; old project tokens can be deleted in the same Tokens table.
