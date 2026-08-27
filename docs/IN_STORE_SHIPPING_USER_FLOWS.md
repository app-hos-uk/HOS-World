# In-store shipping — user flows for manual testing

**Audience:** QA / store staff trainers / manual testers  
**Last updated:** August 2026  
**Scope:** Fixed-rate House of Spells shipping from a Lightspeed till invoice (not marketplace checkout shipping).

Shipping is charged in **USD only**. Customer prices come from the admin rate matrix (`/admin/shipping-rates`), not live UPS/FedEx quotes. Carrier labels are still generated later via Shippo in the back office.

---

## Table of contents

1. [Actors and URLs](#1-actors-and-urls)
2. [Happy-path map](#2-happy-path-map)
3. [Status machine](#3-status-machine)
4. [Test environment setup](#4-test-environment-setup)
5. [Flow A — Admin: rates and boxes](#5-flow-a--admin-rates-and-boxes)
6. [Flow B — Staff: create the shipping order](#6-flow-b--staff-create-the-shipping-order)
7. [Flow C — Customer: claim, addresses, pay](#7-flow-c--customer-claim-addresses-pay)
8. [Flow D — Staff: quote the box charge](#8-flow-d--staff-quote-the-box-charge)
9. [Flow E — Back office: pack, label, hand off](#9-flow-e--back-office-pack-label-hand-off)
10. [Flow F — Admin: monitor](#10-flow-f--admin-monitor)
11. [Negative and edge cases](#11-negative-and-edge-cases)
12. [Suggested end-to-end scripts](#12-suggested-end-to-end-scripts)

---

## 1. Actors and URLs

| Actor | Login role | Where they work |
|---|---|---|
| Store staff (till) | `STORE_STAFF` or `ADMIN` | `/store/shipping` |
| Store staff (packing) | `STORE_STAFF` or `ADMIN` | `/store/shipping/backoffice` |
| Customer (phone) | `CUSTOMER` | `/ship/claim/:token`, `/ship/lookup`, `/ship/request/:id` |
| Admin | `ADMIN` | `/admin/box-sizes`, `/admin/shipping-rates`, `/admin/shipping-dashboard`, `/admin/store-shipments`, `/admin/sku-customs` |

Staff-locked store: if the signed-in user is `STORE_STAFF` with a `storeId`, the Store ID field on the counter is read-only.

Customer shipping pages (`/ship/request/:id`) reject any role other than `CUSTOMER`. Do not try to finish payment while still logged in as staff.

---

## 2. Happy-path map

```
Till scan invoice
        │
        ▼
 Staff creates HOS shipping order  ── QR / magic link ──►  Customer phone
        │                                                       │
        │                                                       ▼
        │                                              Sign in with invoice email
        │                                                       │
        │                                                       ▼
        │                                         Save profile + add address(es)
        │                                                       │
        │                                                       ▼
        │                                    Assign items (or mark Carry in hand)
        │                                                       │
        ▼                                                       │
 Staff sees groups appear (polls every 5s)                      │
        │                                                       │
        ▼                                                       │
 Staff picks box per destination → Finalize quote               │
        │                                                       │
        └──────────────────────────────► Customer sees USD charge
                                                       │
                                                       ▼
                                    Staff confirms payment (cash / card / other)
                                    — or customer pays online if SHIPPING_ONLINE_PAYMENT is on
                                                       │
                                                       ▼
                                              Status PAID — customer can leave
                                                       │
                                                       ▼
                                         Back office: Scan received
                                                       │
                                                       ▼
                              Check off items → Seal package → Weigh & generate label
                                                       │
                                                       ▼
                              Scan carrier barcode → Verify HOS + carrier barcodes
                                                       │
                                                       ▼
                                         Carrier collected → HANDED_TO_CARRIER
```

Two people are in play at once after the invoice is imported: **staff stays on `/store/shipping/:id`**, **customer works on `/ship/request/:id`**. Both screens poll about every 5 seconds.

---

## 3. Status machine

Order (`StoreShipmentRequest.status`) moves roughly as:

| Status | Who caused it | What the other party should see |
|---|---|---|
| `CUSTOMER_DETAILS_REQUIRED` | Staff created the claim, or customer attached their account | Staff: “Waiting for the customer to add addresses…” |
| `AWAITING_PAYMENT` | Staff finalized the box quote | Customer: shipping charge. Default: message to pay at counter. If `SHIPPING_ONLINE_PAYMENT` on: **Pay online** (Stripe). |
| `PAID` | Staff confirmed counter payment, or customer Stripe payment succeeded | Customer: “order has been received”; packing queue lists the order |
| `PACKING` | Back office **Scan received** | Chain of custody recorded (`receivedByEmployee`) |
| `PACKED` | All groups sealed | Ready to weigh / label |
| `LABEL_CREATED` | Shippo label generated | Tracking code on group; customer can see carrier + tracking |
| `READY_FOR_PICKUP` | HOS + carrier barcodes match | **Carrier collected** button appears |
| `HANDED_TO_CARRIER` | Staff confirms pickup | End of store handling |

Problem / hold statuses you may hit: `BLOCKED`, `ITEM_MISSING`, `ADDRESS_ISSUE`, `PAYMENT_ISSUE`, `CANCELLED`. Legacy statuses (`DRAFT`, `QUOTED`, `LABEL_PURCHASED`) can still appear on old rows.

**HOS order number format:** `HOS-{STORECODE}-{DDMMYY}-{NNNN}` (UTC date). Example: `HOS-NYC-270826-0001`.

---

## 4. Test environment setup

### Pre-conditions

- [ ] Production or staging web + API are the build that includes in-store shipping
- [ ] Store has an **active Lightspeed POS connection**
- [ ] A **completed, non-voided** till sale exists with line items
- [ ] That sale has a **customer email**, or you are ready to type one at the counter
- [ ] Test customer account uses **the same email** as the Lightspeed customer
- [ ] Staff user is `STORE_STAFF` assigned to that store (or `ADMIN`)
- [ ] Stripe test/live keys match the environment (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`)
- [ ] Shippo is configured if you will generate real labels
- [ ] Camera permission available if you will test barcode scan on the counter

### Test data to prepare

| Item | Notes |
|---|---|
| Lightspeed invoice A | 2+ line items, customer email = customer test account, destination will be **US** |
| Lightspeed invoice B | Same store, customer email for a **UK / CA** address (tier 2 or 3) |
| Lightspeed invoice C | Sale **with no customer email** (manual email fallback) |
| Lightspeed invoice D | Already used for an in-flight shipping order (duplicate-claim test) |
| Customer account | Role `CUSTOMER`, email matches invoice A |
| Wrong-email account | Another `CUSTOMER` whose email does **not** match invoice A |
| US address | Country that maps to Tier 1 (`US` or `PR`) |
| International address | `GB` / `CA` / other for tier checks |
| Gift address | Second address on the same customer for multi-destination |

### Admin seed check (do this first)

1. Sign in as admin.
2. Open **Box Sizes** → `/admin/box-sizes`.
3. Confirm SMALL / MEDIUM / LARGE / XL / CUSTOM exist and are **On**.
4. Open **Shipping Rates** → `/admin/shipping-rates`.
5. Confirm four tiers (Domestic US, Near-International, Western Europe & UK, Rest of World).
6. **Replace placeholder matrix prices with real House of Spells USD charges** and click **Save rates**. Code defaults only seed a fresh database; they do not overwrite live rows.

---

## 5. Flow A — Admin: rates and boxes

### TC-A-001: View and edit the rate matrix

| Field | Detail |
|---|---|
| **Pre-condition** | Admin logged in |
| **Steps** | 1. `/admin/shipping-rates` <br> 2. Confirm currency is shown as text **USD**, not an editable field <br> 3. Change one SMALL / Tier 1 cell <br> 4. Save rates <br> 5. Reload |
| **Expected** | Saved value persists. Tiers still show “Priced in USD”. |
| **Pass** | [ ] |

### TC-A-002: Edit a geographic tier

| Field | Detail |
|---|---|
| **Steps** | 1. Change a non-catch-all tier’s ISO codes (e.g. add `PR` if missing) <br> 2. Save tier <br> 3. Reload |
| **Expected** | Codes persist. Catch-all tier country field stays disabled (“All other countries”). |
| **Pass** | [ ] |

### TC-A-003: Box dimensions vs customer price

| Field | Detail |
|---|---|
| **Steps** | 1. `/admin/box-sizes` <br> 2. Note that **Fallback price** is not the live customer charge <br> 3. Toggle a box Off / On |
| **Expected** | Inactive boxes disappear from the staff box dropdown. Packaging cost is internal only. |
| **Pass** | [ ] |

### TC-A-004: SKU customs (international only)

| Field | Detail |
|---|---|
| **Steps** | 1. `/admin/sku-customs` if the queue has rows <br> 2. Fill HS code + country of origin <br> 3. Save |
| **Expected** | International quoting is no longer blocked for that SKU. Domestic US orders should not require this. |
| **Pass** | [ ] |

---

## 6. Flow B — Staff: create the shipping order

**Screen:** `/store/shipping`  
**Nav:** Store → **Ship purchase**

### TC-B-001: Happy create (email imported from Lightspeed)

| Field | Detail |
|---|---|
| **Pre-condition** | Staff logged in; completed Lightspeed invoice with customer email |
| **Steps** | 1. Confirm Store ID is correct (locked for store staff) <br> 2. Type or **Scan** the invoice / receipt barcode <br> 3. Leave email blank <br> 4. Tick consent <br> 5. **Create shipping order** |
| **Expected** | Success toast (email queued **or** “share the QR / magic link”). Redirect to `/store/shipping/{id}`. HOS order number shown. Invoice items listed. QR encodes `/ship/lookup?store={storeId}`. Status `CUSTOMER_DETAILS_REQUIRED`. Amber copy: waiting for customer addresses. |
| **Pass** | [ ] |

### TC-B-002: Manual email fallback

| Field | Detail |
|---|---|
| **Pre-condition** | Lightspeed sale has **no** customer email |
| **Steps** | 1. Enter invoice <br> 2. Enter customer email in the optional field <br> 3. Consent + create |
| **Expected** | Order created using the typed email. If you omit email, API error: *This Lightspeed sale has no customer email. Enter the email manually.* |
| **Pass** | [ ] |

### TC-B-003: Consent required

| Field | Detail |
|---|---|
| **Steps** | Create without ticking consent |
| **Expected** | Toast: *Customer must consent to shipping*. No API call / no order. |
| **Pass** | [ ] |

### TC-B-004: Store and invoice required

| Field | Detail |
|---|---|
| **Steps** | As ADMIN with empty Store ID, or empty invoice |
| **Expected** | Toast: *Store and invoice number are required*. |
| **Pass** | [ ] |

### TC-B-005: Barcode scan fills the invoice field

| Field | Detail |
|---|---|
| **Steps** | 1. Click **Scan** <br> 2. Allow camera <br> 3. Scan a barcode |
| **Expected** | Camera starts once (does not flicker restart). Invoice field fills. Toast *Barcode captured*. Scanner closes. |
| **Pass** | [ ] |

### TC-B-006: Duplicate in-flight invoice

| Field | Detail |
|---|---|
| **Pre-condition** | Same invoice already has a shipping order not `CANCELLED`/`BLOCKED`, especially if customer already attached |
| **Steps** | Create again |
| **Expected** | Error: shipping claim already in progress. Do not send another link. |
| **Pass** | [ ] |

---

## 7. Flow C — Customer: claim, addresses, pay

Customers should use a **phone** (or a second browser profile). Do not stay logged in as staff.

There are two ways onto the order:

1. **Magic link** from email → `/ship/claim/{token}`
2. **QR / lookup** → `/ship/lookup?store={storeId}` then HOS number or receipt email

### TC-C-001: Magic link — must sign in

| Field | Detail |
|---|---|
| **Steps** | 1. Open claim URL while logged out <br> 2. Confirm store, invoice, HOS order number <br> 3. **Sign in to continue** |
| **Expected** | Redirect to `/login?redirect=/ship/claim/{token}`. After login as matching customer, return to claim. |
| **Pass** | [ ] |

### TC-C-002: Email must match Lightspeed customer

| Field | Detail |
|---|---|
| **Steps** | Sign in with an account whose email **does not** match the invoice customer |
| **Expected** | Red copy: signed-in email does not match. Continue is not offered (or attach fails with *does not match the customer on this shipping order*). |
| **Pass** | [ ] |

### TC-C-003: Matching email continues to the request page

| Field | Detail |
|---|---|
| **Steps** | Sign in with the invoice email → **Continue to shipping** |
| **Expected** | `/ship/request/{shipmentId}`. Profile fields seed first/last/phone once from the account. Email shown read-only. |
| **Pass** | [ ] |

### TC-C-004: Lookup by HOS number or email

| Field | Detail |
|---|---|
| **Steps** | 1. `/ship/lookup` (or scan the counter QR) <br> 2. Enter HOS order number **or** receipt email <br> 3. Continue |
| **Expected** | Logged-out users go to login then `/ship/request/{id}`. Logged-in matching customer attaches and lands on the request page. Empty query: *Enter your House of Spells shipping order number or email*. Unknown query: *No shipping order found…* |
| **Pass** | [ ] |

### TC-C-005: Save profile

| Field | Detail |
|---|---|
| **Steps** | Edit first name, last name, phone → **Save profile** |
| **Expected** | Toast *Profile saved*. Values persist after refresh. |
| **Pass** | [ ] |

### TC-C-006: Add a shipping address

| Field | Detail |
|---|---|
| **Steps** | 1. **Add address** → `/account/addresses?action=add&returnUrl=/ship/request/{id}` <br> 2. Save a **US** address <br> 3. Confirm return to the shipping request page <br> 4. Address listed |
| **Expected** | Address belongs to this customer. Country is stored so staff later see the correct tier. |
| **Pass** | [ ] |

### TC-C-007: Assign all items to one address

| Field | Detail |
|---|---|
| **Steps** | Leave “Ship items to multiple addresses” unchecked. Leave Carry in hand unchecked. **Confirm items & addresses**. |
| **Expected** | Toast *Items assigned — staff will confirm the box charge*. One shipment group appears. Staff screen (if open) picks up the group within ~5s. Status still `CUSTOMER_DETAILS_REQUIRED` until staff quotes. |
| **Pass** | [ ] |

### TC-C-008: Carry in hand (leave with some items)

| Field | Detail |
|---|---|
| **Pre-condition** | Invoice has 2+ lines |
| **Steps** | Tick **Carry in hand** on one item. Confirm the rest to the address. |
| **Expected** | Only shipped items appear in the staff group. Cannot confirm if every item is carry-in-hand and nothing is assigned to an address (*Select at least one item to ship*). |
| **Pass** | [ ] |

### TC-C-009: Multiple destinations

| Field | Detail |
|---|---|
| **Steps** | 1. Add a second address (e.g. gift / UK) <br> 2. Tick **Ship items to multiple addresses** <br> 3. Pick a destination per item <br> 4. Confirm |
| **Expected** | One shipment group per address. Staff sees two boxes and two destination tiers. |
| **Pass** | [ ] |

### TC-C-010: Pay after staff quote (default: counter payment)

| Field | Detail |
|---|---|
| **Pre-condition** | Staff completed Flow D (status `AWAITING_PAYMENT`). Feature flag `SHIPPING_ONLINE_PAYMENT` determines whether the customer pays online or staff confirm at the counter. |
| **Steps (flag OFF — default)** | 1. Customer screen shows the USD charge and a message to pay at the counter (cash or standalone card machine) <br> 2. Staff selects Cash / Card / Other on their order screen <br> 3. Staff clicks **Confirm payment received** |
| **Steps (flag ON)** | 1. Customer screen shows the USD charge and **Pay online** <br> 2. Customer enters card details (Stripe) <br> 3. Customer clicks **Pay shipping** |
| **Expected** | Success. Status `PAID`. Green banner: customer can leave the store. Groups show box name and USD price. Re-assigning items is blocked once paid. |
| **Pass** | [ ] |

### TC-C-011: Non-customer role cannot use `/ship/request`

| Field | Detail |
|---|---|
| **Steps** | Open `/ship/request/{id}` while logged in as `STORE_STAFF` |
| **Expected** | Access denied. Customer must use a customer account. |
| **Pass** | [ ] |

---

## 8. Flow D — Staff: quote the box charge

**Screen:** `/store/shipping/{id}` (opened automatically after create, or from back office **Open**)

### TC-D-001: Wait, then pick boxes

| Field | Detail |
|---|---|
| **Pre-condition** | Customer completed TC-C-007 (or C-009) |
| **Steps** | 1. Stay on the staff order page (auto-refresh 5s) <br> 2. Confirm destination line includes city/country **and tier name** <br> 3. Select a box per group (recommended size may be pre-selected) <br> 4. Confirm dropdown prices match the matrix for that tier, in USD <br> 5. **Finalize quote — USD xx.xx** |
| **Expected** | Toast *Quote sent to the customer*. Status `AWAITING_PAYMENT`. Customer phone shows the same total. |
| **Pass** | [ ] |

### TC-D-002: CUSTOM box requires a typed price

| Field | Detail |
|---|---|
| **Steps** | Choose **Custom** for a group, enter a USD amount, finalize |
| **Expected** | Charge uses the typed price, not 0. Empty/invalid custom price is rejected. |
| **Pass** | [ ] |

### TC-D-003: Print slip only after paid

| Field | Detail |
|---|---|
| **Steps** | Before payment, confirm **Print shipping slip** is hidden. After `PAID`, click it. |
| **Expected** | Slip PDF opens (`/api/proxy/store-shipment/{id}/slip`). |
| **Pass** | [ ] |

---

## 9. Flow E — Back office: pack, label, hand off

**Screen:** `/store/shipping/backoffice`  
**Nav:** Store → **Back office packing**

Packing queue includes: `PAID`, `SENT_TO_LOGISTICS`, `PACKING`, `PACKED`, `LABEL_CREATED`, `READY_FOR_PICKUP`, `ITEM_MISSING`.

### TC-E-001: Receive (chain of custody)

| Field | Detail |
|---|---|
| **Pre-condition** | Order `PAID` |
| **Steps** | 1. Enter **Your name** <br> 2. **Scan received** |
| **Expected** | Status `PACKING`. Empty name is rejected (*Employee name is required*). Unpaid orders cannot be received. |
| **Pass** | [ ] |

### TC-E-002: Seal package — all items checked

| Field | Detail |
|---|---|
| **Steps** | Check every line → **Seal package** |
| **Expected** | Group `PACKED`. When every group is packed, order `PACKED`. |
| **Pass** | [ ] |

### TC-E-003: Seal package — missing item

| Field | Detail |
|---|---|
| **Steps** | Leave one item unchecked → **Seal package** |
| **Expected** | Error listing missing item names. Order status `ITEM_MISSING`. |
| **Pass** | [ ] |

### TC-E-004: Weigh and generate label

| Field | Detail |
|---|---|
| **Pre-condition** | Group packed (or packing/label states allowed by API) |
| **Steps** | Enter weight in kg → **Weigh & generate label** |
| **Expected** | Shippo label URL opens. Carrier tracking shown. Customer request page eventually shows carrier + tracking. Group `LABEL_CREATED`. |
| **Pass** | [ ] |

### TC-E-005: Verify barcodes

| Field | Detail |
|---|---|
| **Steps** | 1. Paste/scan the **carrier** tracking barcode into the verify field <br> 2. **Verify HOS + carrier barcodes** |
| **Expected** | Match → group `READY_FOR_PICKUP` (order too when all groups ready). Wrong tracking → *Carrier tracking barcode does not match…* |
| **Pass** | [ ] |

Note: the UI sends the HOS order number from the order record automatically. Testers are verifying the **carrier** scan against the generated label.

### TC-E-006: Carrier collected

| Field | Detail |
|---|---|
| **Pre-condition** | Order `READY_FOR_PICKUP` |
| **Steps** | **Carrier collected** |
| **Expected** | Status `HANDED_TO_CARRIER`. Order leaves active packing work. |
| **Pass** | [ ] |

---

## 10. Flow F — Admin: monitor

### TC-F-001: Store shipments list

| Field | Detail |
|---|---|
| **Steps** | `/admin/store-shipments` — filter by status, confirm HOS number, invoice, store, email, tracking |
| **Expected** | The order from the script appears with the latest status. |
| **Pass** | [ ] |

### TC-F-002: Shipping dashboard

| Field | Detail |
|---|---|
| **Steps** | `/admin/shipping-dashboard` on a day you created/paid/packed orders |
| **Expected** | Today’s counters move (Created, Awaiting details, Awaiting payment, Paid, Packing, Ready for carrier, Shipped). Financial cards show USD revenue vs packaging. |
| **Pass** | [ ] |

---

## 11. Negative and edge cases

| ID | Scenario | Expected |
|---|---|---|
| TC-N-001 | Invalid claim token | 404 / *Claim link not found* |
| TC-N-002 | Expired claim token | *Claim link has expired* |
| TC-N-003 | Lookup with empty `q` (API) | **400** *Enter a shipping order number or email* (not 500) |
| TC-N-004 | Lookup unknown email | **404** *No shipping order found…* |
| TC-N-005 | Staff of store A opens store B’s order | Forbidden: *This order belongs to another store* |
| TC-N-006 | Voided / incomplete Lightspeed sale | Create claim fails (not completed / voided) |
| TC-N-007 | Typed till email ≠ Lightspeed customer email | Rejected (email must match sale customer) |
| TC-N-008 | Assign items before invoice lines imported | *Invoice items are not loaded yet* |
| TC-N-009 | Assign after paid | *already paid and cannot be reassigned* |
| TC-N-010 | Finalize quote with no box selected | Rejected |
| TC-N-011 | Receive before paid | *Order must be paid before logistics intake* |
| TC-N-012 | Country alias (e.g. “United States”, “UK”) | Resolves to `US` / `GB` and the correct tier price |
| TC-N-013 | All prices / charges | Always **USD**, never mixed GBP+USD on one order |

---

## 12. Suggested end-to-end scripts

Run these in order on a clean invoice each time. Tick the case IDs as you go.

### Script 1 — Domestic, one box (minimum viable)

1. TC-A-001 (confirm USD matrix)  
2. TC-B-001 (create from till)  
3. TC-C-001 → TC-C-003 (claim + matching login)  
4. TC-C-005, TC-C-006, TC-C-007 (profile, US address, assign)  
5. TC-D-001 (staff quote)  
6. TC-C-010 (pay)  
7. TC-E-001 → TC-E-002 → TC-E-004 → TC-E-005 → TC-E-006  
8. TC-F-001 / TC-F-002 (admin sees Paid → handed to carrier)

**Pass whole script:** [ ]

### Script 2 — Split shipment (US + international)

1. TC-C-009 with one US and one non-US address  
2. TC-D-001: two groups, **different tier names and prices**, same USD currency  
3. Pay once for the **sum** of both boxes  
4. Pack and label **each** group before Carrier collected  

**Pass whole script:** [ ]

### Script 3 — Carry-in-hand + custom box

1. TC-C-008 (one item stays with the customer)  
2. TC-D-002 (CUSTOM price)  
3. Pay and pack only the shipped remainder  

**Pass whole script:** [ ]

### Script 4 — Failure paths (short)

1. TC-B-003, TC-B-006  
2. TC-C-002, TC-C-011  
3. TC-E-003  
4. TC-N-003, TC-N-004  

**Pass whole script:** [ ]

---

## Tester notes (known product behaviour)

- Payment defaults to **staff confirmation at the counter** (cash / standalone card machine / other). When the feature flag `SHIPPING_ONLINE_PAYMENT` is enabled, the customer sees a **Pay online** button and pays with Stripe on their phone instead. Neither path uses Lightspeed till tender.
- Staff and customer UIs poll; if something looks stale, wait 5 seconds or refresh.
- **Print shipping slip** is for store paperwork after payment; the **carrier label** is generated in back office after weigh.
- `/store/lookup` is loyalty member search, **not** shipping lookup. Shipping lookup is `/ship/lookup`.
- Live matrix prices live in the database. Changing `DEFAULT_MATRIX` in code will not update production.
