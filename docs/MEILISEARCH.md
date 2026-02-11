# Meilisearch in HOS

**Meilisearch is the only search engine** used by HOS. Elasticsearch has been removed from the codebase.

## Is Meilisearch a separate service?

**Meilisearch is not a NestJS microservice in this repo.** It is an **external search engine**:

- **Meilisearch** = the open-source search engine (a separate server you run or host).
- **Search microservice** (`services/search`) = our NestJS app that **talks to** Meilisearch as a **client**.

So there is no `services/meilisearch` folder. Meilisearch runs as its own process (Docker image, Meilisearch Cloud, or self-hosted).

---

## How it’s used in this codebase

| Location | Role |
|----------|------|
| **Search microservice** (`services/search`) | Imports `MeilisearchModule`. Connects to `MEILISEARCH_HOST`, indexes products, and exposes **`/api/search`** (primary) and `/api/meilisearch/*` endpoints. If `MEILISEARCH_HOST` is not set, search **falls back to Prisma** (no typo tolerance). |
| **Monolith API** (`services/api`) | Also has a `MeilisearchModule` that connects to Meilisearch and exposes similar endpoints. |
| **Gateway** | Proxies `/api/search` and `/api/meilisearch` to the **search** microservice. |

So Meilisearch is a **dependency** of the search service (and optionally the API), not a deployable “HOS service” itself.

---

## Running Meilisearch locally (Docker Compose)

An **optional** Meilisearch container is defined in `docker-compose.yml` under the profile `search-engines` so it doesn’t start by default.

**Start stack including Meilisearch:**

```bash
docker compose --profile search-engines up -d
```

**Point the search service at it:**

Set in your env or in the `search` service in docker-compose:

- `MEILISEARCH_HOST=http://meilisearch:7700`
- `MEILISEARCH_API_KEY=<master-key>` (optional; matches `MEILISEARCH_MASTER_KEY` in the meilisearch service)

Then (re)start the search service so it connects to Meilisearch. Without `MEILISEARCH_HOST`, the search service still runs and uses Prisma-based search.

---

## Railway / production

- Add a **Meilisearch** instance (e.g. [Meilisearch Cloud](https://www.meilisearch.com/cloud) or a container/service in your platform).
- In the **search** service (and API if used), set:
  - `MEILISEARCH_HOST=https://your-meilisearch-host`
  - `MEILISEARCH_API_KEY=<your-key>` if your instance uses a key.

---

## Env vars (search service / API)

| Variable | Meaning |
|----------|--------|
| `MEILISEARCH_HOST` | Meilisearch URL (e.g. `http://meilisearch:7700` or `https://…`). If unset, Meilisearch is disabled and search uses Prisma. |
| `MEILISEARCH_API_KEY` | Optional API key (master key for local, or key from Meilisearch Cloud). |
| `SYNC_PRODUCTS_ON_STARTUP` | If `true`, the search service runs a full product sync to Meilisearch on startup. |

---

## Summary

- **Meilisearch** = the only search engine; external (not a NestJS app in this repo).
- **Search microservice** = NestJS app that uses Meilisearch as a client; it can run without Meilisearch using Prisma fallback.
- Optional **Meilisearch container** is in `docker-compose.yml` with profile `search-engines` for local use.

---

## Railway / deployment

- **Elasticsearch** is no longer used. If you had an Elasticsearch service in your Railway project, you can remove it from the Dashboard.
- Remove any **`ELASTICSEARCH_*`** environment variables from the search and API services in Railway.
- Ensure **Meilisearch** is provisioned (e.g. Meilisearch Cloud) and **`MEILISEARCH_HOST`** (and optionally **`MEILISEARCH_API_KEY`**) are set for the search service.
