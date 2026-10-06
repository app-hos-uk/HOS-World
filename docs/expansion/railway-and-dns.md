# Railway and DNS for country frontends

This branch does not deploy to production. Staging receives the branch only after review. Each country is a separate Railway frontend. The API, Postgres, Redis, and Meilisearch stay shared.

## Services

| Service | Railway env | Public host |
|---|---|---|
| Global hub | `NEXT_PUBLIC_SITE_ROLE=hub` on the landing app | houseofspells.com |
| US marketing | `NEXT_PUBLIC_MARKET_CODE=US` on the landing app | us.houseofspells.com |
| US shop | existing web service, no market code stored | shop.houseofspells.com |
| Malaysia marketing | `NEXT_PUBLIC_MARKET_CODE=MY` on a second landing service | houseofspells.my |
| Malaysia shop | second web service, `hos_market_code=MY` | shop.houseofspells.my |
| API | existing API service | api.houseofspells.com |

Do not put Railway hostnames in the apps, QR codes, or customer emails.

## DNS

- `houseofspells.com` stays on the current US landing until the hub service is ready. Then point it at the hub and point `us.houseofspells.com` at the US landing.
- `houseofspells.my`, `shop.houseofspells.my`, and `join.houseofspells.my` point at the Malaysia services.
- Cloudflare proxy stays on. `CF-IPCountry` is read only by the hub middleware. It sets a cookie. It does not redirect.

## Flags to turn on in staging, not production

| Flag | Default | Staging action |
|---|---|---|
| `POS_PRODUCT_PUSH` | on | Turn off to stop Lightspeed product writes and online stock writes |
| `MARKETPLACE_OWNED_CATALOG` | off | Turn on with `MULTI_VENDOR_OFFERS` |
| `MULTI_VENDOR_OFFERS` | off | Turn on before marketplace-owned publish |
| `ANCHOR_STORE_GATING` | off | Turn on only after the real House of Spells outlets are marked as anchor stores |
| `MARKET_CATALOG` | off | Turn on for a shop that sends `x-market-code` |

Products with no `ProductMarket` row stay visible in every country. A second loyalty wallet per person is not enabled. `LoyaltyMembership.userId` stays unique so the live US wallet is unchanged.
