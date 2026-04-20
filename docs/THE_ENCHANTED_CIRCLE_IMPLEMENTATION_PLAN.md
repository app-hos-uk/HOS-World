# The Enchanted Circle — Implementation Plan

## House of Spells Loyalty & Community Ecosystem

**For:** Internal Team  
**Date:** April 2026  
**Version:** 2.0 (Final)  
**Classification:** Internal

---

## 1. Executive Summary

House of Spells is launching **The Enchanted Circle** — a loyalty and community ecosystem that unifies our e-commerce marketplace, UK physical stores, the NYC Times Square flagship, and all future global outlets into a single customer experience.

A customer who walks into our London Soho shop, earns points, and then redeems them on our website from Tokyo should feel no friction.

This document is the complete plan covering programme design, platform architecture, POS integration, and phased delivery.

---

## 2. Programme Design

### 2.1 Customer Journey

Customers evolve through a progression:

**Visitor** → **Fan** → **Member** → **Ambassador**

- **Visitor:** Walks into a store or visits the website
- **Fan:** Makes a purchase, signs up for The Enchanted Circle
- **Member:** Engages regularly, attends events, climbs tiers
- **Ambassador:** Refers friends, creates content, represents the brand

### 2.2 Tier System (6 Tiers)

| Tier | Name | Points Required | Earning Rate | Key Benefits |
|------|------|----------------|--------------|--------------|
| 1 | **Initiate** | 0 (sign-up) | 1x per £1/$1 | Welcome bonus, birthday reward, member pricing |
| 2 | **Spellcaster** | 1,000 lifetime | 1.25x | Free standard shipping, early sale access (12 hrs) |
| 3 | **Enchanter** | 3,000 lifetime | 1.5x | Free express shipping, early product drops (24 hrs), priority support |
| 4 | **Dragon Keeper** | 7,500 lifetime | 2x | Free worldwide shipping, exclusive products, in-store event priority |
| 5 | **Archmage Circle** | 15,000 lifetime | 2.5x | VIP events, personal shopping advisor, first access to collaborations |
| 6 | **Council of Realms** | Invite-only (top 1%) | 3x | Annual gathering, product co-creation, dedicated relationship manager |

**Tier progression** is based on a composite score: 50% total spend + 25% purchase frequency + 25% engagement actions (reviews, events, referrals, quests).

### 2.3 How Customers Earn Points

| Action | Points | Limits |
|--------|--------|--------|
| Every £1/$1 spent (base rate) | 1–3 pts (tier-dependent) | No limit |
| Sign up | 100 pts | Once |
| Complete profile | 50 pts | Once |
| Write product review | 25 pts | 3/month |
| Photo review | 50 pts | 3/month |
| Social media share | 10 pts | 5/day |
| Refer a friend (friend's first purchase) | 500 pts (you) + 200 pts (friend) | No limit |
| Complete a Fandom Quest | 50–500 pts | Per quest |
| Birthday | 200–600 pts (tier-scaled) | Annual |
| Store visit (QR check-in) | 15 pts | 1/day/store |
| Attend in-store event | 100 pts | Per event |
| Fandom Quiz | 25 pts | Weekly |
| Membership anniversary | 150 pts | Annual |

### 2.4 How Customers Redeem Points

| Reward | Points Cost |
|--------|-------------|
| Discount on purchase | 100 pts = £1/$1 |
| Free shipping upgrade | 200 pts |
| Exclusive product unlock | Varies |
| Raffle entry (signed memorabilia) | 50 pts/entry |
| Charity donation | 100 pts = £1 |
| Experience rewards (tours, premieres) | 2,000–10,000 pts |
| Gift card | 500 pts = £5/$5 |
| Early access pass | 300 pts |

### 2.5 Earning vs. Redemption Scope — Key Rule

**Earning is broad:**
- All HOS product purchases (online or in-store) always earn points
- Third-party marketplace seller products earn points IF the seller has opted in
- Non-purchase actions (reviews, referrals, events, etc.) always earn points

**Redemption is restricted:**
- Points can ONLY be redeemed at the HOS marketplace checkout (online) or at HOS physical outlet POS registers
- Points CANNOT be redeemed at a third-party seller's own store or website
- When a customer redeems points on a third-party seller's product at marketplace checkout, HOS absorbs the discount cost — the seller's payout is unaffected

---

## 3. HOS as a Seller on Its Own Marketplace

### 3.1 The Model

House of Spells operates as a **priority seller** on its own marketplace, alongside third-party sellers and wholesalers.

| Seller Type | Who | Capabilities |
|-------------|-----|--------------|
| B2C Seller | Third-party individual sellers | List products, fulfil orders |
| Wholesaler | B2B sellers | Bulk pricing, B2B terms |
| **Platform Retail (HOS)** | **House of Spells itself** | All seller capabilities PLUS: physical outlets, POS integration, loyalty programme ownership |

### 3.2 Product Catalogue — Single Source of Truth

There is ONE master product catalogue. HOS outlets are consumers of this catalogue, not creators of a parallel one.

**If a product already exists in the catalogue:**
- HOS retail team assigns it to the relevant store channels
- The product syncs to that store's POS
- No duplication

**If a product does NOT exist in the catalogue:**
- HOS retail team submits it through the standard product onboarding flow (the same pipeline other sellers use)
- Goes through procurement → catalogue → marketing → finance → publish
- Only then can it be assigned to stores or the online channel

### 3.3 Product Channel Assignment

Every product has explicit channel assignments:
- **Online** — visible on houseofspells.com
- **Per store** — stocked at specific outlets (synced to that store's POS)

A product can be:
- Online only (not in any physical store)
- In-store exclusive (one or more stores, not online)
- Both online and in-store
- Available at some stores but not others

### 3.4 Channel-Aware Pricing

The same product can have different prices on different channels:

| Scenario | How It Works |
|----------|-------------|
| Regional pricing | Same mug: £12.99 in London, $15.99 in NYC |
| Online vs in-store | Same item, potentially different price per channel |
| New batch arrival | New procurement batch at different cost — selling price can be adjusted per channel independently |
| Promotional pricing | Time-limited price override per channel |

The POS receives the channel-specific price for each outlet, not a generic price.

---

## 4. Omnichannel Unification

### 4.1 Unified Loyalty Wallet

Every customer has one Enchanted Circle membership that works everywhere:
- One points balance
- One tier
- Earn anywhere (online, any HOS store, via actions)
- Redeem at HOS marketplace checkout or HOS outlet POS

### 4.2 In-Store Experience

At checkout in any HOS store:
1. Staff scans loyalty QR or enters phone/email
2. System shows: name, tier, balance, available rewards
3. Customer can redeem points for a discount
4. Sale completes, new points earned automatically
5. Receipt shows points earned and new balance

### 4.3 Multi-Region Strategy

| Aspect | Approach |
|--------|----------|
| Currency | Points are currency-agnostic: 1 pt per £1 = 1 pt per $1 |
| Redemption value | 100 pts = £1 in UK, $1 in US |
| Points expiry | 24 months inactivity (where legally permitted, region-aware) |
| Data privacy | GDPR in UK/EU, CCPA in US, per local regulation |
| Communication | Email + WhatsApp (primary for international) + SMS + push |

### 4.4 Tourist Conversion (Times Square)

Times Square will attract massive international tourist footfall:
- QR code at store entrance for instant sign-up
- Staff offer enrollment at checkout
- Post-visit WhatsApp/email follow-up sequence
- "You have X points! Redeem on our website" re-engagement

---

## 5. POS/ERP Integration — Agnostic Design

### 5.1 POS-Agnostic Architecture

The platform integrates with POS systems through a generic adapter interface. Lightspeed is the first implementation, but the system supports adding Square, Shopify POS, Clover, or any other POS in the future without rewriting core logic.

### 5.2 What Lightspeed Handles vs. What the Platform Handles

| Function | Lightspeed (POS) | HOS Platform |
|----------|-------------------|-------------|
| In-store checkout | Primary | — |
| In-store payments | Primary | — |
| Online payments | — | Primary (Stripe) |
| Product catalogue (master) | Receives data | Primary |
| Pricing | Receives channel price | Primary |
| In-store stock counts | Primary | Receives updates |
| Online inventory | Receives updates | Primary |
| Customer database | Lightweight copy | Primary |
| Loyalty programme | Calls platform at checkout | Primary |
| Staff management | Primary | — |
| Reporting (unified) | Provides store data | Primary |

### 5.3 Key Sync Flows

**Products:** Platform → POS (one-way). Only products assigned to a specific store sync to that store's POS.

**Inventory:** Bidirectional. Online sales update POS stock. In-store sales update platform stock. Nightly reconciliation catches discrepancies.

**Customers:** Platform → POS (lightweight: name, email, phone for lookup). Full customer data stays in the platform.

**Sales:** POS → Platform. Every in-store sale flows to the platform for reporting, loyalty, and analytics.

### 5.4 Lightspeed Setup (Since HOS Hasn't Started Yet)

Since HOS has not begun capturing data in Lightspeed, we define the product structure, categories, and tax brackets from day one. Lightspeed is configured to mirror the platform's fandom and category structure.

SKU format: `[FANDOM]-[CATEGORY]-[SEQUENCE]-[VARIANT]`
Example: `HP-MUG-0001-RED` (Harry Potter, Mug, item #1, Red variant)

### 5.5 Future Seller POS

The architecture supports any marketplace seller connecting their own POS system in the future. Each seller/outlet gets its own POS connection with its own credentials. HOS outlets are simply the first implementation.

---

## 6. Marketing & Communication

### 6.1 Channels

| Channel | Status | Use |
|---------|--------|-----|
| Email | Existing (Nodemailer) | Transactional + campaigns |
| WhatsApp | Existing (Twilio) | Primary for international, campaign broadcasts |
| SMS | New (Twilio) | Fallback where WhatsApp unavailable |
| Push notifications | New (Expo Push) | Mobile app alerts |

### 6.2 Marketing Automation (External Platform)

We will integrate a marketing automation platform (Customer.io or Klaviyo) for:
- Welcome journeys for new members
- Post-purchase follow-ups ("Leave a review for 25 points")
- Tier upgrade celebrations
- Points expiry warnings
- Birthday campaigns
- Re-engagement flows (30/60/90 day inactivity)
- Behaviour-based triggers

The loyalty engine fires events to the marketing platform. The marketing platform decides what to send, when, and on which channel.

### 6.3 WhatsApp as Primary International Channel

WhatsApp is critical for international tourists. All key loyalty communications (welcome, points earned, tier upgrade, event invitations) have WhatsApp templates.

---

## 7. Additional Modules

### 7.1 Event & Experience Management

- Create product launches, fan meetups, themed events
- RSVP and ticketing
- Tier-based access (e.g., Dragon Keeper+ only)
- Attendance tracking with automatic point awards
- Audience targeting for invitations

### 7.2 Segmentation Engine

- Rule-based audience builder
- Segment by: fandom affinity, spend tier, engagement level, geography, product affinity
- Dynamic audiences that update automatically
- Tourist vs. local detection
- Pre-built templates: "VIP at risk", "Rising stars", "Fandom enthusiasts"

### 7.3 Ambassador Programme

- Extends the existing influencer system
- Ambassador features unlock at Dragon Keeper tier
- Personal referral dashboard, social sharing rewards
- UGC (user-generated content) submission and rewards
- Commission optionally received as loyalty points at a bonus rate

### 7.4 Brand Partnership Module

- Brand partners can fund campaigns through HOS
- Target specific fandom segments (e.g., Warner Bros. funds 2x points on Harry Potter)
- Sponsored exclusive products for specific tiers
- Partner reporting dashboard

### 7.5 Fandom Profiles

- Computed fandom identity per member
- Built from: purchase history, quiz results, event attendance, wishlist, social activity
- Powers personalised campaigns and product recommendations

### 7.6 Analytics & Reporting

- Customer lifetime value (CLV)
- Repeat purchase rate (members vs non-members)
- Campaign-to-revenue attribution
- Programme cost (points liability)
- Fandom trend analysis
- Tier distribution monitoring

---

## 8. Build vs. Buy Decisions

| Capability | Decision | Rationale |
|-----------|----------|-----------|
| Loyalty engine | **Build custom** | Core differentiator, brand-specific |
| POS integration | **Build custom** | Specific sync requirements |
| Marketing automation | **Buy (Customer.io or Klaviyo)** | 4-6 months to build; these platforms do it better |
| Event management | **Build custom** | Brand-unique, lightweight |
| Brand partnerships | **Build custom** | Unique to our business model |
| Ambassador/referral | **Extend existing** | Influencer system is 65% there |
| SMS + Push | **Buy (Twilio + Expo)** | Standard integrations |
| BI/Analytics | **Build dashboards + Metabase** | Mix of custom + BI tool |

---

## 9. Architecture Decision

**Modular monolith — built inside the existing application.**

All new modules are added to the existing NestJS backend and Next.js frontend. No new Railway services. No new databases. No microservice infrastructure.

External platforms (Customer.io, Twilio SMS, Expo Push, Metabase) are connected via API keys stored in Railway environment variables.

If the business grows to 100+ stores and 2M+ members with a dedicated loyalty team, the clean module boundaries allow extraction into a separate service — but that's a future decision driven by concrete evidence.

---

## 10. Implementation Roadmap

### Wave 1: Foundation (Months 1–3)

| Phase | What | Duration | Outcome |
|-------|------|----------|---------|
| **Phase 1** | Core loyalty engine + HOS seller setup + channel pricing model | 6–7 weeks | Members can join, earn on purchases, redeem at checkout, see tier and history. Products have channel assignments and per-channel pricing. |
| **Phase 2** | POS integration (adapter layer + Lightspeed) + in-store loyalty | 5–6 weeks | Products sync to POS, customers earn and redeem at the register, inventory syncs bidirectionally. |

### Wave 2: Engagement (Months 3–5)

| Phase | What | Duration | Outcome |
|-------|------|----------|---------|
| **Phase 3** | Extended earn rules + fandom profiles + referrals | 3–4 weeks | Points for reviews, shares, quizzes, check-ins. Fandom identity computed per member. |
| **Phase 4** | Marketing automation integration | 4–5 weeks | Automated journeys across email, WhatsApp, SMS, push. Welcome, post-purchase, tier upgrade, birthday flows. |

### Wave 3: Community (Months 5–8)

| Phase | What | Duration | Outcome |
|-------|------|----------|---------|
| **Phase 5** | Event & experience management | 3–4 weeks | Create events, RSVP, attendance tracking, tier-based access. |
| **Phase 6** | Segmentation engine | 3–4 weeks | Rule-based audience builder, dynamic segments, tourist detection. |
| **Phase 7** | Ambassador programme | 3–4 weeks | Ambassador tier unlock, UGC rewards, referral dashboard. |
| **Phase 8** | Brand partnership module | 3–4 weeks | Brand-funded campaigns, co-branded promotions, partner reporting. |

### Wave 4: Intelligence (Months 8–11)

| Phase | What | Duration | Outcome |
|-------|------|----------|---------|
| **Phase 9** | Analytics, CLV, attribution | 3–4 weeks | Management dashboards, CLV, campaign ROI, fandom trends. |
| **Phase 10** | Advanced features + global readiness | 2–3 weeks | Click & collect, product campaigns, new outlet onboarding playbook. |

### Key Milestones

| Milestone | Target |
|-----------|--------|
| Enchanted Circle soft launch (online) | End of Month 2 |
| In-store loyalty live (all UK stores) | End of Month 3 |
| Times Square launch-ready | End of Month 3 |
| Marketing automation live | End of Month 5 |
| Full community platform | End of Month 8 |
| Complete ecosystem | End of Month 11 |

---

## 11. Success Metrics

| Metric | Target (Year 1) |
|--------|----------------|
| Customer capture rate (in-store) | 30%+ of transactions |
| Customer capture rate (online) | 60%+ of transactions |
| Total members | 50,000+ |
| Monthly active members | 25%+ of total |
| Repeat purchase rate (members vs non-members) | 2x higher |
| Average order value (members vs non-members) | 15%+ higher |
| Customer lifetime value (members) | 3x higher than non-members |
| Redemption rate | 30–50% (healthy range) |
| Tier distribution | Pyramid: ~60% / 20% / 10% / 5% / 3% / 1% |

---

## 12. SDLC Process

### Environments

| Environment | Purpose | Deploys from |
|-------------|---------|-------------|
| Development | Engineers test new features | `develop` branch |
| Staging | QA testing, stakeholder review | `staging` branch |
| Production | Live customers | `main` branch |

### Workflow per Phase

1. Create feature branch from `develop`
2. Build the feature (Composer 2)
3. Code review (Opus reviews against this spec)
4. Fix any issues
5. Local testing + unit tests
6. PR to `develop` → auto-deploys to dev environment
7. Test on dev environment
8. Merge to `staging` → QA team tests
9. Merge to `main` → production release
10. Monitor for issues

---

## 13. Risk Register

| Risk | Mitigation |
|------|-----------|
| Points liability grows uncontrollably | 24-month inactivity expiry, quarterly monitoring, adjustable earn rates |
| Low in-store adoption | Staff incentives, 30-second enrollment, visible QR codes |
| POS downtime affects loyalty | Graceful fallback — sale still processes, loyalty reconciled when restored |
| Marketing platform costs exceed budget | Start on free tier, scale based on actual volume |
| Tourist customers never re-engage | WhatsApp as primary channel (higher open rates), 7-day follow-up sequence |
| Inventory sync discrepancies | Nightly automated reconciliation, discrepancy alerts |

---

**End of Document**
