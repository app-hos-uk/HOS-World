# HOS Marketplace — Module-wise Features & Functions Reference

> **Document Date:** September 29, 2026
> **Audience:** Product Managers, Project Managers, QA Teams
> **Platform:** House of Spells (HOS) Marketplace
> **Version:** 1.0

---

## Table of Contents

1. [Module Index](#module-index)
2. [Authentication & Identity](#1-authentication--identity)
3. [Product & Catalog](#2-product--catalog)
4. [Commerce (Cart, Checkout, Orders)](#3-commerce-cart-checkout-orders)
5. [Loyalty — The Enchanted Circle](#4-loyalty--the-enchanted-circle)
6. [POS Integration (Lightspeed)](#5-pos-integration-lightspeed)
7. [Seller & Vendor Management](#6-seller--vendor-management)
8. [Influencer Program](#7-influencer-program)
9. [Finance & Accounting](#8-finance--accounting)
10. [Shipping & Fulfillment](#9-shipping--fulfillment)
11. [Inventory Management](#10-inventory-management)
12. [Marketing & CRM](#11-marketing--crm)
13. [Content Management (CMS)](#12-content-management-cms)
14. [Gamification (Quests, Badges, Leaderboard)](#13-gamification-quests-badges-leaderboard)
15. [Access Control & Permissions](#14-access-control--permissions)
16. [Notifications & Messaging](#15-notifications--messaging)
17. [Gift Cards](#16-gift-cards)
18. [Search (Meilisearch)](#17-search-meilisearch)
19. [Integrations Framework](#18-integrations-framework)
20. [Analytics & Reporting](#19-analytics--reporting)
21. [Support & Help](#20-support--help)
22. [GDPR & Privacy](#21-gdpr--privacy)
23. [Store Operations (Ship-from-Store, Store Staff)](#22-store-operations-ship-from-store-store-staff)
24. [Events & Click-Collect](#23-events--click-collect)
25. [Taxonomy (Fandoms, Characters, Universes, Departments)](#24-taxonomy-fandoms-characters-universes-departments)
26. [Digital Products & Downloads](#25-digital-products--downloads)
27. [Appendix A: Feature Flag Reference](#appendix-a-feature-flag-reference)
28. [Appendix B: User Role Reference](#appendix-b-user-role-reference)

---

## Module Index

| # | Module | Status | Backend Modules | Controllers | Key Integration |
|---|--------|--------|-----------------|-------------|-----------------|
| 1 | Authentication & Identity | Active | `AuthModule`, `UsersModule` | 2 | Passport, JWT, Google/Facebook/Apple OAuth |
| 2 | Product & Catalog | Active | `ProductsModule`, `CatalogModule`, `SubmissionsModule`, `VendorProductsModule`, `PublishingModule`, `DuplicatesModule` | 6+ | Meilisearch, Cloudinary |
| 3 | Commerce (Cart, Checkout, Orders) | Active | `CartModule`, `OrdersModule`, `PaymentsModule`, `CancellationsModule`, `PromotionsModule`, `InvoicesModule`, `ReturnPoliciesModule` | 7+ | Stripe, Stripe Connect |
| 4 | Loyalty — The Enchanted Circle | Active | `LoyaltyModule`, `LoyaltyAnalyticsModule`, `AmbassadorModule`, `BrandPartnershipsModule`, `PartnerReferralsModule`, `FoundingMembersModule` | 6+ | Lightspeed POS |
| 5 | POS Integration (Lightspeed) | Active | `PosModule`, `ChannelsModule`, `StoreAdminModule` | 3+ | Lightspeed Retail API |
| 6 | Seller & Vendor Management | Active | `SellersModule`, `VendorProductsModule`, `VendorLedgerModule` | 3+ | Stripe Connect |
| 7 | Influencer Program | Active | `InfluencersModule`, `InfluencerInvitationsModule`, `InfluencerStorefrontsModule`, `InfluencerCommissionsModule`, `InfluencerPayoutsModule`, `InfluencerCampaignsModule`, `ReferralsModule` | 7 | — |
| 8 | Finance & Accounting | Active | `FinanceModule`, `AccountingModule`, `SettlementsModule`, `VendorLedgerModule`, `InvoicesModule` | 5+ | Stripe, PDFKit, ExcelJS |
| 9 | Shipping & Fulfillment | Active | `ShippingModule`, `CourierModule`, `FulfillmentModule`, `LogisticsModule`, `StoreShipmentModule` | 5+ | FedEx, DHL, Shippo |
| 10 | Inventory Management | Active | `InventoryModule`, `DiscrepanciesModule` | 2+ | Lightspeed POS |
| 11 | Marketing & CRM | Active | `MarketingModule`, `JourneyModule`, `SegmentationModule`, `NewsletterModule`, `SocialSharingModule` | 5+ | SMTP, Twilio |
| 12 | Content Management (CMS) | Active | `CMSModule`, `BlogModule`, `TemplatesModule`, `GalleryModule`, `TestimonialsModule`, `NavigationModule` | 6+ | Strapi |
| 13 | Gamification | Active | `GamificationModule`, `BadgesModule`, `QuestsModule`, `QuizModule` | 4 | — |
| 14 | Access Control & Permissions | Active | `AccessControlModule` | 1 | — |
| 15 | Notifications & Messaging | Active | `NotificationsModule`, `EmailModule`, `WhatsAppModule` | 3 | Nodemailer, Twilio |
| 16 | Gift Cards | Active | `GiftCardsModule` | 1 | Stripe, Lightspeed |
| 17 | Search (Meilisearch) | Active | `MeilisearchModule` | 1 | Meilisearch v1.11 |
| 18 | Integrations Framework | Active | `IntegrationsModule`, `WebhooksModule` | 2 | Multiple providers |
| 19 | Analytics & Reporting | Active | `AnalyticsModule`, `DashboardModule`, `MonitoringModule` | 3+ | Sentry, ExcelJS |
| 20 | Support & Help | Active | `SupportModule` | 1 | — |
| 21 | GDPR & Privacy | Active | `GDPRModule`, `ComplianceModule` | 2 | — |
| 22 | Store Operations | Active | `StoreShipmentModule`, `StoreAdminModule`, `ClickCollectModule` | 3+ | Lightspeed, Shippo |
| 23 | Events & Click-Collect | Active | `EventsModule`, `ClickCollectModule` | 2 | — |
| 24 | Taxonomy | Active | `TaxonomyModule`, `FandomsModule`, `CharactersModule`, `UniversesModule`, `DepartmentsModule`, `CollectionsModule` | 6+ | — |
| 25 | Digital Products & Downloads | Active | `DigitalProductsModule` | 1 | AWS S3 |

---

## 1. Authentication & Identity

### Purpose
Handles user registration, login (email/password and OAuth), JWT token management, password resets, account security, team invitations, and session management across the platform.

### Status
**Active** — Fully operational with email/password, Google, Facebook, and Apple OAuth.

### Key Features
- Email/password registration with validation
- OAuth social login (Google, Facebook, Apple Sign-In)
- JWT access tokens (short-lived) + refresh tokens (httpOnly cookies)
- Password reset via email magic link
- Account lockout after repeated failed login attempts
- Team/staff invitation system with token-based acceptance
- Role assignment on registration (CUSTOMER default, others via invitation/admin)
- Session refresh without re-login
- Token blacklisting on logout
- Multi-device session support
- Admin impersonation ("view as" capability)

### User Roles
- **All roles** interact with this module for authentication
- **ADMIN** manages user accounts, roles, invitations
- **CUSTOMER, B2C_SELLER, WHOLESALER, INFLUENCER** self-register
- **Staff roles** (PROCUREMENT, FULFILLMENT, CATALOG, MARKETING, FINANCE, CMS_EDITOR) are invited

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/login` | Login page (email/password + OAuth buttons) |
| `/register` | Customer registration |
| `/forgot-password` | Password reset request |
| `/reset-password` | Password reset with token |
| `/seller/onboarding` | Seller registration flow |
| `/wholesaler/onboarding` | Wholesaler registration flow |
| `/influencer-invite/[token]` | Influencer invitation acceptance |
| `/profile` | User profile management |
| `/profile/change-password` | Password change |

### API Endpoints

#### Registration & Login
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/register` | Register new user (honeypot + required fandom challenge for customers) |
| POST | `/api/auth/login` | Email/password login; sets auth cookies |
| POST | `/api/auth/logout` | Revoke all refresh tokens; bump tokenVersion to invalidate access JWTs; clear cookies |
| POST | `/api/auth/refresh` | Rotate access token via body or `refresh_token` cookie |
| POST | `/api/auth/guest-checkout` | Passwordless customer from guest checkout; merges cart |
| GET | `/api/auth/fandom-challenge` | Get HMAC-signed fandom trivia challenge for registration |
| POST | `/api/auth/fandom-quiz` | Complete fandom quiz; awards "Explorer" badge |
| GET | `/api/auth/me` | Get authenticated user profile |

#### OAuth
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/auth/google` | Initiate Google OAuth flow |
| GET | `/api/auth/google/callback` | Google OAuth callback; sets cookies; redirects to frontend |
| GET | `/api/auth/facebook` | Initiate Facebook OAuth flow |
| GET | `/api/auth/facebook/callback` | Facebook OAuth callback |
| GET | `/api/auth/apple` | Initiate Apple OAuth flow |
| GET | `/api/auth/apple/callback` | Apple OAuth callback |
| GET | `/api/auth/oauth/accounts` | List linked OAuth accounts |
| DELETE | `/api/auth/oauth/accounts/:provider` | Unlink OAuth provider |

#### Password & Email Verification
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/forgot-password` | Send password reset email (always returns success) |
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/change-password` | Change password (authenticated) |
| POST | `/api/auth/send-verification-email` | Send verification email to current user |
| POST | `/api/auth/resend-verification` | Resend verification by email (public) |
| POST | `/api/auth/verify-email` | Verify email with token |

#### Invitations & Team
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/auth/invitation` | Validate seller invitation token |
| POST | `/api/auth/accept-invitation` | Accept seller invitation + create account |
| POST | `/api/auth/select-character` | Select character avatar + favorite fandoms |

#### User Profile
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/users/profile` | Get full user profile (incl. B2B fields, loyalty) |
| PUT | `/api/users/profile` | Update profile (name, avatar, theme, country, currency, birthday) |
| GET | `/api/users/profile/gamification` | Gamification stats (points, level, badges, quests) |
| GET | `/api/users/profile/badges` | User's earned badges |
| GET | `/api/users/profile/collections` | User's product collections |
| PUT | `/api/users/password` | Change password (rejects OAuth-only accounts) |
| DELETE | `/api/users/account` | Soft-delete account |

#### Admin User Management
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/users` | Paginated user list with search/role/status filters |
| POST | `/api/admin/users` | Create admin user |
| GET | `/api/admin/users/:id` | Get user by ID |
| PUT | `/api/admin/users/:id` | Update user |
| PUT | `/api/admin/users/:id/toggle-status` | Toggle active/inactive |
| DELETE | `/api/admin/users/:id` | Delete user |
| POST | `/api/admin/users/:id/reset-password` | Reset user password |
| GET | `/api/admin/users/stats` | User stats by role/status |

### Database Models
- `User` — Core user account (email, passwordHash, role, status, gdprConsent, gamification fields)
- `Customer` — Extended buyer profile (loyaltyTier, company fields for B2B)
- `RefreshToken` — JWT refresh token storage
- `OAuthAccount` — Linked OAuth provider accounts
- `SellerInvitation` — Team invitation records
- `ActivityLog` — User action audit trail

### Dependencies
- `DatabaseModule`, `CacheModule`, `EmailModule`, `AccessControlModule`

### Third-Party Integrations
- **Google OAuth** — Social login via `passport-google-oauth20`
- **Facebook OAuth** — Social login via `passport-facebook`
- **Apple Sign-In** — Social login via `passport-apple`
- **bcrypt** — Password hashing
- **jsonwebtoken / @nestjs/jwt** — Token generation and verification

### Feature Flags
- None (always active)

---

## 2. Product & Catalog

### Purpose
Manages the entire product lifecycle from creation through approval to publication. Covers admin product creation, seller product submissions, bulk CSV import, vendor marketplace listings, duplicate detection, catalog enrichment pipeline, and product publishing workflow.

### Status
**Active** — Full multi-channel product management with approval pipeline.

### Key Features
- Admin product creation (DRAFT → ACTIVE lifecycle)
- Seller product submission with multi-stage approval pipeline (Procurement → Finance → Catalog → Marketing → Content)
- Vendor listing from existing catalog (instant, no approval needed)
- Bulk CSV import/export for sellers
- Duplicate detection on name, SKU, barcode, EAN
- Idempotency protection (same product from same seller within 2 minutes rejected)
- Product variations (size, color, etc.) with per-option pricing
- Image management (file upload + URL, Cloudinary integration)
- SEO fields (metaTitle, metaDescription)
- Shipping dimensions (weight, length, width, height)
- Product status lifecycle: DRAFT → ACTIVE → INACTIVE / OUT_OF_STOCK
- Publish-readiness gate (name, description, price, image, category required)
- Bulk actions (publish, unpublish, set inactive, delete)
- Product type support: SIMPLE and VARIANT
- Platform-owned vs seller-owned products
- Volume pricing tiers
- Product bundles
- Recently viewed products tracking

### User Roles
| Role | Capabilities |
|------|-------------|
| ADMIN | Full CRUD, status management, bulk actions, pricing |
| CATALOG | Product creation and enrichment |
| B2C_SELLER | Submit products, browse catalog, vendor listing, bulk import |
| WHOLESALER | Submit products, bulk import, bulk pricing |
| PROCUREMENT | Review and approve/reject submissions |
| FINANCE | Approve pricing on submissions |
| MARKETING | Add marketing content to submissions |
| CUSTOMER | Browse and search products |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/products` | Public product listing with filters |
| `/products/[id]` | Product detail page |
| `/admin/products` | Admin product management |
| `/admin/products/create` | Admin product creation form |
| `/admin/products/pricing` | Price management |
| `/admin/vendor-products` | Vendor product oversight |
| `/admin/submissions` | Submission approval queue |
| `/admin/catalog` | Catalog management |
| `/seller/products` | Seller's own products |
| `/seller/submit-product` | Submit new product / browse catalog |
| `/seller/submissions` | Seller's submission history |
| `/seller/products/bulk` | Bulk CSV import/export |
| `/wholesaler/products` | Wholesaler's products |
| `/wholesaler/submit-product` | Wholesaler product submission |
| `/wholesaler/submissions` | Wholesaler submissions |
| `/wholesaler/bulk` | Wholesaler bulk import |
| `/catalog/dashboard` | Catalog staff dashboard |
| `/catalog/entries` | Catalog entries management |
| `/procurement/dashboard` | Procurement staff dashboard |
| `/procurement/submissions` | Procurement submission review |

### API Endpoints

#### Products (Public & Admin)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/products` | List products (public, filtered, paginated) |
| GET | `/api/products/:id` | Get product details |
| GET | `/api/products/search` | Search products |
| GET | `/api/products/recently-viewed` | Get recently viewed products |
| POST | `/api/products/recently-viewed` | Track product view |
| GET | `/api/products/export/csv` | Export products as CSV |
| POST | `/api/products/import` | Import products from array |
| POST | `/api/admin/products` | Create product (admin) |
| PUT | `/api/admin/products/:id` | Update product (admin) |
| DELETE | `/api/admin/products/:id` | Delete product (admin) |
| GET | `/api/admin/products/:id/publish-readiness` | Check publish readiness |

#### Submissions
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/submissions` | Create product submission |
| GET | `/api/submissions` | List submissions |
| GET | `/api/submissions/:id` | Get submission details |
| PUT | `/api/submissions/:id` | Update submission |
| DELETE | `/api/submissions/:id` | Delete submission |
| POST | `/api/submissions/:id/resubmit` | Resubmit rejected submission |
| POST | `/api/submissions/bulk` | Bulk create submissions (max 50) |
| GET | `/api/submissions/browse-catalog` | Browse catalog for vendor listing |
| GET | `/api/submissions/check-duplicates` | Check for duplicate products |
| PUT | `/api/submissions/:id/procurement-approve` | Procurement approval |
| PUT | `/api/submissions/:id/procurement-reject` | Procurement rejection |
| PUT | `/api/submissions/:id/finance-approve` | Finance approval |
| PUT | `/api/submissions/:id/catalog-complete` | Catalog completion |
| PUT | `/api/submissions/:id/marketing-complete` | Marketing completion |
| PUT | `/api/submissions/:id/content-complete` | Content completion (creates product) |

#### Catalog & Vendor Products
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/catalog` | Browse catalog |
| GET | `/api/catalog/dashboard` | Catalog dashboard stats |
| POST | `/api/vendor-products` | Create vendor listing |
| GET | `/api/vendor-products` | List vendor products |
| PUT | `/api/vendor-products/:id` | Update vendor product |
| DELETE | `/api/vendor-products/:id` | Remove vendor listing |

#### Duplicates
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/duplicates/check` | Check for duplicate products |
| GET | `/api/duplicates` | List detected duplicates |
| POST | `/api/duplicates/:id/resolve` | Resolve duplicate |

### Database Models
- `Product` — Core product entity (name, description, price, status, sellerId, images, SEO, dimensions)
- `ProductVariation` — Variation dimensions (e.g., Size, Color)
- `ProductVariationOption` — Individual options (e.g., Small, Medium, Large)
- `ProductImage` — Product image records (url, alt, order)
- `ProductSubmission` — Seller submission with approval status
- `VendorProduct` — Vendor marketplace listing linking seller to existing product
- `ProductAttribute` — Dynamic attribute values
- `ProductBundle` — Bundle product configurations
- `ProductVolumePricing` — Tiered pricing rules
- `ProductView` — Recently viewed product tracking

### Dependencies
- `DatabaseModule`, `MeilisearchModule`, `UploadsModule`, `StorageModule`, `CacheModule`

### Third-Party Integrations
- **Cloudinary** — Image upload and optimization
- **AWS S3** — Image storage
- **Meilisearch** — Product indexing and search

### Feature Flags
- None identified (products are a core module, always active)

---

## 3. Commerce (Cart, Checkout, Orders)

### Purpose
Handles the complete purchase lifecycle from cart management through checkout, payment processing, order tracking, returns, cancellations, and invoice generation. Includes coupon/promotion system and multi-vendor order splitting.

### Status
**Active** — Full e-commerce flow with Stripe payments.

### Key Features
- Persistent server-side cart for authenticated users
- Add to cart with quantity and variant selection
- Cart item management (update quantity, remove)
- Coupon/promo code application and validation
- Multi-step checkout flow (Cart → Checkout → Payment)
- Shipping address selection and method choice
- Tax calculation (Stripe Tax integration)
- Stripe payment processing (card, Apple Pay, Google Pay)
- Gift card payment at checkout
- Loyalty points redemption at checkout
- Order creation with multi-vendor split
- Order confirmation email
- Order status tracking with timeline
- Order history for customers and sellers
- Return request system with configurable policies
- Order cancellation workflow
- Invoice generation (PDF via PDFKit)
- Bulk order support for wholesalers
- Refund processing (full and partial)
- Configurable return policies per seller
- Promotion engine (percentage, fixed amount, free shipping, BOGO)

### User Roles
| Role | Capabilities |
|------|-------------|
| CUSTOMER | Cart, checkout, order history, returns |
| WHOLESALER | Bulk orders, B2B checkout |
| B2C_SELLER | View and process orders for their products |
| ADMIN | Full order management, refunds, cancellations |
| FULFILLMENT | Order processing and shipment |
| FINANCE | Settlement and payout management |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/cart` | Shopping cart page |
| `/checkout` | Checkout flow (address, shipping) |
| `/payment` | Payment processing page |
| `/orders` | Customer order history |
| `/orders/[id]` | Order detail page |
| `/track-order` | Public order tracking |
| `/returns` | Return request list |
| `/returns/[id]` | Return request detail |
| `/seller/orders` | Seller order management |
| `/wholesaler/orders` | Wholesaler orders |
| `/admin/orders` | Admin order management |
| `/admin/orders/[id]` | Admin order detail |
| `/admin/promotions` | Promotion management |
| `/admin/settlements` | Settlement management |
| `/admin/discrepancies` | Order discrepancies |

### API Endpoints

#### Cart
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/cart` | Get current user's cart |
| POST | `/api/cart/items` | Add item to cart |
| PUT | `/api/cart/items/:id` | Update cart item quantity |
| DELETE | `/api/cart/items/:id` | Remove item from cart |
| DELETE | `/api/cart` | Clear entire cart |
| POST | `/api/cart/apply-coupon` | Apply coupon code |
| DELETE | `/api/cart/coupon` | Remove applied coupon |

#### Orders
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/orders` | Create order from cart |
| GET | `/api/orders` | List orders (filtered by role) |
| GET | `/api/orders/:id` | Get order details |
| PUT | `/api/orders/:id/status` | Update order status |
| GET | `/api/orders/track/:trackingNumber` | Track order by tracking number |
| GET | `/api/orders/seller` | Get seller's orders |
| GET | `/api/orders/admin` | Get all orders (admin) |
| POST | `/api/orders/:id/notes` | Add order note |

#### Payments
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/payments/create-intent` | Create Stripe PaymentIntent |
| POST | `/api/payments/confirm` | Confirm payment |
| POST | `/api/payments/webhook` | Stripe webhook handler |
| POST | `/api/payments/refund` | Process refund |
| GET | `/api/payments/stripe-connect/onboard` | Seller Stripe Connect onboarding |
| GET | `/api/payments/stripe-connect/dashboard` | Seller Stripe dashboard link |
| POST | `/api/payments/stripe-connect/payout` | Trigger seller payout |

#### Returns
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/returns` | Create return request |
| GET | `/api/returns` | List return requests |
| GET | `/api/returns/:id` | Get return details |
| PUT | `/api/returns/:id` | Update return status |
| POST | `/api/returns/:id/approve` | Approve return |
| POST | `/api/returns/:id/reject` | Reject return |

#### Cancellations
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/cancellations` | Request order cancellation |
| GET | `/api/cancellations` | List cancellations |
| PUT | `/api/cancellations/:id` | Process cancellation |

#### Promotions
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/promotions` | Create promotion/coupon |
| GET | `/api/promotions` | List promotions |
| GET | `/api/promotions/:id` | Get promotion details |
| PUT | `/api/promotions/:id` | Update promotion |
| DELETE | `/api/promotions/:id` | Delete promotion |
| POST | `/api/promotions/validate` | Validate coupon code |

#### Invoices
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/invoices/:orderId` | Get invoice for order |
| GET | `/api/invoices/:orderId/pdf` | Download invoice PDF |

#### Return Policies
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/return-policies` | List return policies |
| POST | `/api/return-policies` | Create return policy |
| PUT | `/api/return-policies/:id` | Update return policy |
| DELETE | `/api/return-policies/:id` | Delete return policy |

### Database Models
- `Order` — Purchase record (userId, sellerId, status, total, shipping, tax, loyaltyPointsRedeemed)
- `OrderItem` — Individual line items in an order
- `Cart` — User's shopping cart
- `CartItem` — Items in the cart with quantity/variant
- `Transaction` — Financial transaction records
- `ReturnRequest` — Return/refund request with status
- `ReturnPolicy` — Configurable return policies per seller
- `CouponUsage` — Tracks coupon redemptions
- `Promotion` — Coupon/promotion rules (type, discount, conditions)
- `Invoice` — Generated invoice records
- `Cancellation` — Order cancellation records

### Dependencies
- `DatabaseModule`, `PaymentsModule`, `ShippingModule`, `TaxModule`, `LoyaltyModule`, `GiftCardsModule`, `NotificationsModule`, `EmailModule`

### Third-Party Integrations
- **Stripe** — Payment processing, PaymentIntents, refunds
- **Stripe Connect** — Multi-vendor payment splitting and seller payouts
- **Stripe Tax** — Automated tax calculation
- **PDFKit** — Invoice PDF generation

### Feature Flags
- `LOYALTY_REDEMPTION_AT_CHECKOUT` — Enable/disable loyalty point redemption during checkout

---

## 4. Loyalty — The Enchanted Circle

### Purpose
Implements the House of Spells loyalty and community ecosystem, unifying online marketplace and physical store experiences. Manages points earning, redemption, tier progression, campaigns, founding members, ambassador programme, and brand partnerships.

### Status
**Active** — Core loyalty engine live with earning, redemption, tiers, and POS integration.

### Key Features
- **Membership enrollment** — Customers join "The Enchanted Circle"
- **Points earning** — Automatic on purchases (1 pt per $1 base rate)
- **Tier-based multipliers** — 1.0× to 3.0× earn rates across 6 tiers
- **Engagement earning** — Points for reviews, referrals, social shares, quizzes, check-ins, profile completion
- **Birthday and anniversary bonuses** — Automatic annual awards
- **Points redemption** — Discount codes, free shipping, gift cards, raffle entries, charity donations, early access
- **Loyalty wallet** — Complete transaction ledger (earn, burn, adjust, expire, reverse)
- **6-tier system** — Initiate → Spellcaster → Enchanter → Dragon Keeper → Archmage Circle → Council of Realms
- **Weekly tier review** — Automatic tier progression (Sundays 2:00 AM)
- **Points expiry** — 24 months from date earned
- **Bonus campaigns** — Time-limited multipliers or flat bonuses
- **POS voucher redemption** — Convert loyalty points to Lightspeed gift cards
- **Founding member programme** — One-time 500 point bonus for early registrants
- **Ambassador programme** — Extends influencer system at Dragon Keeper tier
- **Brand partnership campaigns** — Brand-funded targeted point boosts
- **Partner referral tracking** — External partner referral commissions
- **Loyalty analytics dashboard** — CLV, redemption rates, tier distribution
- **Manual point adjustments** — Admin can add/deduct points with reason
- **Points reversal on POS void** — Automatic clawback

### User Roles
| Role | Capabilities |
|------|-------------|
| CUSTOMER | Enroll, earn, redeem, view tier/balance/history |
| ADMIN | Full programme management, campaigns, adjustments, analytics |
| STORE_STAFF | POS loyalty lookup, voucher redemption |
| MARKETING | Campaign management |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/loyalty` | Customer loyalty dashboard (tier, balance, history) |
| `/loyalty/rewards` | Rewards catalog for redemption |
| `/loyalty/join` | Enrollment page |
| `/join.houseofspells.com` | Public loyalty join page (subdomain) |
| `/admin/loyalty` | Admin loyalty dashboard |
| `/admin/loyalty/members` | Member management |
| `/admin/loyalty/earn-rules` | Earn rule configuration |
| `/admin/loyalty/redemption` | Redemption option management |
| `/admin/loyalty/campaigns` | Bonus campaign management |
| `/admin/loyalty/tiers` | Tier configuration |
| `/admin/loyalty/transactions` | Transaction ledger |
| `/admin/loyalty/analytics` | Loyalty analytics |
| `/admin/loyalty/founding-members` | Founding member management |
| `/admin/loyalty/ambassadors` | Ambassador programme |
| `/admin/loyalty/brand-partnerships` | Brand partnership management |

### API Endpoints

#### Customer — `/api/loyalty`
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/loyalty/enroll` | Join The Enchanted Circle loyalty programme |
| GET | `/api/loyalty/membership` | Current membership details (tier, balance, history) |
| GET | `/api/loyalty/preferences` | Marketing channel opt-ins |
| PATCH | `/api/loyalty/preferences` | Update marketing opt-ins |
| GET | `/api/loyalty/transactions` | Points history (paginated) |
| GET | `/api/loyalty/purchase-history` | Unified online + in-store purchase history |
| GET | `/api/loyalty/tier-progress` | Progress toward next tier |
| GET | `/api/loyalty/redemption-options` | Reward catalogue (optional `region`) |
| POST | `/api/loyalty/redeem` | Redeem points for a reward (requires `idempotencyKey` to prevent double-burn) |
| GET | `/api/loyalty/referral` | Referral code and stats |
| POST | `/api/loyalty/referral/generate` | Ensure referral code exists |
| GET | `/api/loyalty/fandom-profile` | Fandom affinity scores |
| GET | `/api/loyalty/card` | Digital card / QR payload |
| POST | `/api/loyalty/check-in` | Store QR check-in (15 pts) |
| POST | `/api/loyalty/redeem-in-store` | Burn points → in-store gift card or promo code |
| GET | `/api/loyalty/pos-vouchers` | Full in-store voucher history |
| GET | `/api/loyalty/pos-vouchers/active` | Active in-store vouchers only |
| POST | `/api/loyalty/pos-vouchers/:id/cancel` | Cancel unused ISSUED voucher, restore points |

#### POS / Staff — `/api/loyalty` (API key or staff JWT)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/loyalty/lookup` | Lookup member by email, phone, or card |
| POST | `/api/loyalty/pos/enroll` | In-store staff enrolment |
| POST | `/api/loyalty/pos/redeem-for-voucher` | Burn points at till → Lightspeed gift card/promo |
| POST | `/api/loyalty/pos/redeem-otp/send` | Send OTP for staff-assisted redemption |
| POST | `/api/loyalty/pos/redeem-otp/verify` | Verify customer OTP at till |

#### Admin — `/api/admin/loyalty`
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/loyalty/dashboard` | Programme KPIs |
| GET | `/api/admin/loyalty/tiers` | List tiers |
| GET | `/api/admin/loyalty/tiers/:id` | Tier detail |
| PUT | `/api/admin/loyalty/tiers/:id` | Update tier |
| POST | `/api/admin/loyalty/tiers/review` | Queue tier re-review for all members |
| GET | `/api/admin/loyalty/earn-rules` | List earn rules |
| POST | `/api/admin/loyalty/earn-rules` | Create earn rule |
| PUT | `/api/admin/loyalty/earn-rules/:id` | Update earn rule |
| DELETE | `/api/admin/loyalty/earn-rules/:id` | Delete earn rule |
| GET | `/api/admin/loyalty/redemption-options` | List redemption options |
| POST | `/api/admin/loyalty/redemption-options` | Create redemption option |
| PUT | `/api/admin/loyalty/redemption-options/:id` | Update redemption option |
| DELETE | `/api/admin/loyalty/redemption-options/:id` | Delete/deactivate redemption option |
| GET | `/api/admin/loyalty/campaigns` | List bonus campaigns |
| POST | `/api/admin/loyalty/campaigns` | Create campaign |
| PUT | `/api/admin/loyalty/campaigns/:id` | Update campaign |
| DELETE | `/api/admin/loyalty/campaigns/:id` | Delete campaign |
| GET | `/api/admin/loyalty/members` | List members (search, paginated) |
| GET | `/api/admin/loyalty/members/:userId` | Member detail |
| DELETE | `/api/admin/loyalty/members/:userId` | Delete membership |
| PATCH | `/api/admin/loyalty/members/:userId/deactivate` | Deactivate member |
| PATCH | `/api/admin/loyalty/members/:userId/reactivate` | Reactivate member |
| POST | `/api/admin/loyalty/members/send-email` | Send template email to members |
| POST | `/api/admin/loyalty/adjust` | Manual points adjustment |
| GET | `/api/admin/loyalty/transactions` | Global points ledger |
| GET | `/api/admin/loyalty/settings` | Programme settings |
| PUT | `/api/admin/loyalty/settings` | Update programme settings |
| GET | `/api/admin/loyalty/runtime-status` | Effective loyalty/POS/accounting gates |
| GET | `/api/admin/loyalty/members/:userId/instruments` | Member balances (points, GCs, vouchers) |
| GET | `/api/admin/loyalty/fandom-profile/:userId` | Member fandom profile |
| POST | `/api/admin/loyalty/fandom-profiles/recompute` | Recompute all fandom profiles |
| GET | `/api/admin/loyalty/pos-vouchers` | List POS vouchers |
| GET | `/api/admin/loyalty/pos-vouchers/:id` | Voucher detail |
| POST | `/api/admin/loyalty/pos-vouchers/:id/cancel` | Manager cancel voucher |
| POST | `/api/admin/loyalty/pos-vouchers/:id/retry` | Retry failed voucher issuance |
| POST | `/api/admin/loyalty/pos-vouchers/:id/reassign` | Reassign voucher to different store |
| GET | `/api/admin/loyalty/identity-reviews` | Open Lightspeed ↔ HOS identity reviews |
| PATCH | `/api/admin/loyalty/identity-reviews/:id` | Resolve identity review |
| GET | `/api/admin/loyalty/liability-report` | Loyalty & gift-card liability report |

#### Founding Members
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/founding-members` | List founding members |
| POST | `/api/founding-members/register` | Register as founding member |
| GET | `/api/founding-members/status` | Check founding member eligibility |

#### Ambassador
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/ambassador/dashboard` | Ambassador dashboard |
| POST | `/api/ambassador/apply` | Apply for ambassador status |
| GET | `/api/ambassador/referrals` | Ambassador referral history |

#### Brand Partnerships
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/brand-partnerships` | Create brand partnership |
| GET | `/api/brand-partnerships` | List partnerships |
| PUT | `/api/brand-partnerships/:id` | Update partnership |
| DELETE | `/api/brand-partnerships/:id` | Delete partnership |

#### Partner Referrals
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/partner-referrals` | Create partner referral |
| GET | `/api/partner-referrals` | List partner referrals |
| GET | `/api/partner-referrals/stats` | Referral statistics |

#### Loyalty Analytics — `/api/admin/loyalty-analytics`
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/loyalty-analytics/health` | Programme health KPIs |
| GET | `/api/admin/loyalty-analytics/snapshots` | Snapshot timeline (startDate/endDate) |
| GET | `/api/admin/loyalty-analytics/clv/distribution` | CLV bucket distribution |
| GET | `/api/admin/loyalty-analytics/clv/top` | Top members by CLV |
| GET | `/api/admin/loyalty-analytics/clv/churn` | Churn risk report |
| GET | `/api/admin/loyalty-analytics/attribution` | Campaign attribution report |
| GET | `/api/admin/loyalty-analytics/attribution/:campaignId` | Campaign ROI timeline |
| GET | `/api/admin/loyalty-analytics/fandom-trends` | Fandom trend analysis |
| GET | `/api/admin/loyalty-analytics/tiers` | Tier analysis with CLV and revenue |
| GET | `/api/admin/loyalty-analytics/channels` | Web vs POS performance |
| GET | `/api/admin/loyalty-analytics/campaign-performance` | Campaign KPIs |
| GET | `/api/admin/loyalty-analytics/cohorts` | Cohort retention matrix |
| POST | `/api/admin/loyalty-analytics/snapshots/compute` | Manually trigger daily snapshot |
| POST | `/api/admin/loyalty-analytics/clv/recompute` | Recompute CLV for all members |
| GET | `/api/admin/loyalty-analytics/export/:type` | Export report (JSON default) |

### Database Models
- `LoyaltyMember` — Membership record (userId, tier, totalPointsEarned, currentBalance, enrolledAt)
- `LoyaltyTransaction` — Point transaction ledger (type: EARN/BURN/ADJUST/EXPIRE/REVERSE, points, reason)
- `LoyaltyTier` — Tier definitions (name, level, pointsRequired, multiplier, benefits)
- `LoyaltyEarnRule` — Point earning rules (action, points, limit, period)
- `LoyaltyRedemptionOption` — Available rewards (name, pointsCost, value, type)
- `LoyaltyCampaign` — Bonus campaigns (multiplier, startDate, endDate, targetSegment)
- `FoundingMember` — Early registrant records
- `Ambassador` — Ambassador programme membership
- `BrandPartnership` — Brand-funded campaign records
- `PartnerReferral` — External partner referral tracking
- `LoyaltyPointsExpiry` — Scheduled point expiry records

### Dependencies
- `DatabaseModule`, `UsersModule`, `PosModule`, `GiftCardsModule`, `NotificationsModule`, `EmailModule`, `SegmentationModule`

### Third-Party Integrations
- **Lightspeed POS** — In-store loyalty lookup and voucher redemption
- **Stripe** — Payment integration for point value

### Feature Flags
- `LOYALTY_ENABLED` — Master toggle for the loyalty programme
- `LOYALTY_REDEMPTION_AT_CHECKOUT` — Allow point redemption during web checkout
- `LOYALTY_POS_INTEGRATION` — Enable POS loyalty features
- `FOUNDING_MEMBERS_OPEN` — Allow new founding member registrations
- `AMBASSADOR_PROGRAMME_ENABLED` — Enable ambassador features

---

## 5. POS Integration (Lightspeed)

### Purpose
Integrates the HOS platform with Lightspeed Retail POS for omnichannel operations. Handles product sync, inventory sync, customer sync, sales import, loyalty integration at the register, and channel management.

### Status
**Active** — Lightspeed adapter implemented with bidirectional sync.

### Key Features
- **POS-agnostic adapter architecture** — Lightspeed is first implementation; supports future POS systems
- **Product sync (Platform → POS)** — One-way push of products assigned to store channels
- **Inventory sync (bidirectional)** — Online sales update POS stock; in-store sales update platform stock
- **Nightly inventory reconciliation** — Automated discrepancy detection
- **Customer sync (Platform → POS)** — Lightweight customer data push for lookup
- **Sales import (POS → Platform)** — In-store sales flow to platform for reporting and loyalty
- **Loyalty lookup at register** — Staff scan loyalty QR or search by email/phone
- **POS voucher creation** — Convert loyalty points to Lightspeed gift cards
- **Channel management** — Product assignment to online/store channels with per-channel pricing
- **Multi-store support** — Each store has its own POS connection and credentials
- **Store-specific SKU mapping**
- **Voided sale point reversal** — Auto-clawback of loyalty points on voided POS sales
- **Gift card reconciliation** — 6-hourly check of POS-issued gift cards vs platform records

### User Roles
| Role | Capabilities |
|------|-------------|
| ADMIN | POS configuration, store management, sync monitoring |
| STORE_STAFF | Loyalty lookup, voucher redemption, sales processing |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/admin/pos` | POS integration settings |
| `/admin/pos/stores` | Store POS connections |
| `/admin/pos/sync` | Sync status and logs |
| `/store/lookup` | Staff loyalty member lookup |

### API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/pos/config` | Get POS configuration |
| PUT | `/api/pos/config` | Update POS configuration |
| POST | `/api/pos/sync/products` | Trigger product sync to POS |
| POST | `/api/pos/sync/inventory` | Trigger inventory sync |
| POST | `/api/pos/sync/customers` | Trigger customer sync |
| GET | `/api/pos/sync/status` | Get sync status |
| GET | `/api/pos/sales` | Get imported POS sales |
| POST | `/api/pos/sales/import` | Import POS sale |
| GET | `/api/pos/loyalty/lookup` | Look up loyalty member at POS |
| POST | `/api/pos/loyalty/voucher` | Create POS loyalty voucher |
| GET | `/api/pos/loyalty/voucher/:id` | Get voucher status |
| GET | `/api/pos/stores` | List configured stores |
| POST | `/api/pos/stores` | Add store POS connection |
| PUT | `/api/pos/stores/:id` | Update store connection |
| GET | `/api/pos/reconciliation` | Get reconciliation results |
| POST | `/api/pos/reconciliation/run` | Trigger manual reconciliation |
| GET | `/api/channels` | List channels |
| POST | `/api/channels` | Create channel |
| PUT | `/api/channels/:id` | Update channel |
| DELETE | `/api/channels/:id` | Delete channel |
| POST | `/api/channels/:id/products` | Assign products to channel |

### Database Models
- `Store` — Physical store record (name, code, address, posProvider, posCredentials)
- `StoreStaff` — Staff assignment to stores
- `PosConnection` — POS system connection configuration
- `PosSale` — Imported POS sale records
- `PosSaleItem` — Line items from POS sales
- `PosSync` — Sync job tracking (status, lastSync, errors)
- `Channel` — Sales channel (online, store-specific)
- `ChannelProduct` — Product-channel assignment with channel-specific pricing
- `PosGiftCard` — POS-issued gift card tracking
- `PosReconciliation` — Reconciliation run results

### Dependencies
- `DatabaseModule`, `LoyaltyModule`, `InventoryModule`, `GiftCardsModule`, `ProductsModule`

### Third-Party Integrations
- **Lightspeed Retail API** — POS operations, product/inventory/customer/sales sync

### Feature Flags
- `LOYALTY_POS_INTEGRATION` — Enable POS loyalty features
- `POS_SYNC_ENABLED` — Master toggle for POS synchronization

---

## 6. Seller & Vendor Management

### Purpose
Manages the seller ecosystem including B2C seller and wholesaler onboarding, application approval, profile management, storefront customization, subscription plans, commission configuration, and custom domains/subdomains.

### Status
**Active** — Full seller lifecycle management.

### Key Features
- Seller application and onboarding flow
- Admin approval/rejection workflow for seller applications
- Seller profile with store branding (name, logo, description, banner)
- Multi-seller types: B2C Seller, Wholesaler
- Seller storefront pages with custom themes
- Multi-tenant subdomain support (`{slug}.houseofspells.com`)
- Custom domain support for sellers
- Commission rate configuration per seller
- Subscription plan management
- Seller analytics dashboard (sales, revenue, products)
- Vendor product listings from existing catalog
- Vendor ledger for financial tracking
- Seller status tracking: PENDING → APPROVED → ACTIVE / SUSPENDED
- Seller team management
- Wholesaler-specific features (company name, VAT, credit terms, bulk pricing)

### User Roles
| Role | Capabilities |
|------|-------------|
| B2C_SELLER | Full seller operations, product management, order processing |
| WHOLESALER | Bulk product submission, wholesale operations, fulfilment centre shipping |
| ADMIN | Seller oversight, application approval, commission management |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/sellers` | Public seller directory |
| `/sellers/[slug]` | Seller storefront page |
| `/seller/onboarding` | Seller application/onboarding |
| `/seller/dashboard` | Seller dashboard |
| `/seller/profile` | Seller profile management |
| `/seller/products` | Seller product list |
| `/seller/orders` | Seller order management |
| `/seller/themes` | Storefront theme customization |
| `/seller/analytics` | Seller analytics |
| `/wholesaler/onboarding` | Wholesaler application |
| `/wholesaler/dashboard` | Wholesaler dashboard |
| `/wholesaler/profile` | Wholesaler profile |
| `/admin/sellers` | Admin seller list |
| `/admin/seller-applications` | Seller application queue |
| `/admin/seller-analytics` | Platform-wide seller analytics |

### API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/sellers/apply` | Submit seller application |
| GET | `/api/sellers` | List sellers (public) |
| GET | `/api/sellers/:id` | Get seller details |
| GET | `/api/sellers/slug/:slug` | Get seller by slug (storefront) |
| PUT | `/api/sellers/:id` | Update seller profile |
| PUT | `/api/sellers/:id/status` | Update seller status (admin) |
| GET | `/api/sellers/:id/analytics` | Get seller analytics |
| GET | `/api/sellers/:id/products` | Get seller's products |
| GET | `/api/sellers/:id/orders` | Get seller's orders |
| PUT | `/api/sellers/:id/commission` | Set commission rate (admin) |
| GET | `/api/sellers/admin/applications` | List seller applications (admin) |
| POST | `/api/sellers/admin/applications/:id/approve` | Approve application |
| POST | `/api/sellers/admin/applications/:id/reject` | Reject application |
| GET | `/api/vendor-ledger` | Get vendor financial ledger |
| GET | `/api/vendor-ledger/:sellerId` | Get specific vendor ledger |
| POST | `/api/vendor-ledger/payout` | Process vendor payout |

### Database Models
- `Seller` — Vendor profile (userId, storeName, slug, logo, description, commission, status, posConnectionId)
- `SellerApplication` — Application record with approval workflow
- `SellerSubscription` — Subscription plan assignment
- `VendorProduct` — Vendor listing linked to existing catalog product
- `VendorLedger` — Financial ledger entries for vendor
- `VendorPayout` — Payout records

### Dependencies
- `DatabaseModule`, `UsersModule`, `PaymentsModule`, `DomainsModule`, `ThemesModule`

### Third-Party Integrations
- **Stripe Connect** — Seller payment processing and payouts

### Feature Flags
- None identified (core module)

---

## 7. Influencer Program

### Purpose
Manages the influencer/affiliate ecosystem including invitations, onboarding, storefront curation, referral tracking, commission calculation, payout processing, and campaign management.

### Status
**Active** — Full influencer lifecycle from invitation through earnings.

### Key Features
- Invitation-based onboarding (admin sends invitation email with token)
- Influencer profile management
- Personal storefront curation (select products to showcase)
- Referral link generation with tracking
- Short link support (`/i/[slug]`)
- Click and conversion tracking
- Commission calculation (percentage of referred sales)
- Payout management and processing
- Campaign creation and management (admin-driven)
- Campaign assignment to influencers
- Influencer analytics (clicks, conversions, earnings)
- Commission tier system
- Bulk invitation sending

### User Roles
| Role | Capabilities |
|------|-------------|
| INFLUENCER | Dashboard, storefront, product links, earnings, profile |
| ADMIN | Invitations, commission config, campaigns, payouts, analytics |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/influencer-invite/[token]` | Invitation acceptance page |
| `/influencer/dashboard` | Influencer dashboard |
| `/influencer/earnings` | Earnings and commission history |
| `/influencer/product-links` | Product link generation |
| `/influencer/storefront` | Storefront curation |
| `/influencer/profile` | Profile management |
| `/i/[slug]` | Short referral link redirect |
| `/admin/influencers` | Influencer management |
| `/admin/influencers/invitations` | Invitation management |
| `/admin/influencers/commissions` | Commission configuration |
| `/admin/influencers/payouts` | Payout management |
| `/admin/influencers/campaigns` | Campaign management |

### API Endpoints

#### Influencer Core
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/influencers` | List influencers (admin) |
| GET | `/api/influencers/:id` | Get influencer details |
| PUT | `/api/influencers/:id` | Update influencer profile |
| GET | `/api/influencers/me` | Get own influencer profile |
| GET | `/api/influencers/:id/analytics` | Get influencer analytics |

#### Invitations
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/influencer-invitations` | Send invitation (admin) |
| GET | `/api/influencer-invitations` | List invitations (admin) |
| GET | `/api/influencer-invitations/:token` | Validate invitation token |
| POST | `/api/influencer-invitations/:token/accept` | Accept invitation |
| POST | `/api/influencer-invitations/bulk` | Send bulk invitations |
| DELETE | `/api/influencer-invitations/:id` | Revoke invitation |

#### Storefronts
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/influencer-storefronts/:id` | Get influencer storefront |
| PUT | `/api/influencer-storefronts/:id` | Update storefront |
| POST | `/api/influencer-storefronts/:id/products` | Add products to storefront |
| DELETE | `/api/influencer-storefronts/:id/products/:productId` | Remove product |

#### Commissions
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/influencer-commissions` | List commissions |
| GET | `/api/influencer-commissions/:id` | Get commission details |
| PUT | `/api/influencer-commissions/:id` | Update commission rate |
| GET | `/api/influencer-commissions/summary` | Commission summary stats |

#### Payouts
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/influencer-payouts` | List payouts |
| POST | `/api/influencer-payouts` | Process payout |
| GET | `/api/influencer-payouts/:id` | Get payout details |

#### Campaigns
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/influencer-campaigns` | Create campaign |
| GET | `/api/influencer-campaigns` | List campaigns |
| GET | `/api/influencer-campaigns/:id` | Get campaign details |
| PUT | `/api/influencer-campaigns/:id` | Update campaign |
| DELETE | `/api/influencer-campaigns/:id` | Delete campaign |
| POST | `/api/influencer-campaigns/:id/influencers` | Assign influencers |

#### Referrals
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/referrals` | List referrals |
| GET | `/api/referrals/:code` | Get referral by code |
| POST | `/api/referrals/track` | Track referral click |
| POST | `/api/referrals/convert` | Record referral conversion |

### Database Models
- `Influencer` — Influencer profile (userId, slug, bio, commissionRate, status)
- `InfluencerInvitation` — Invitation record (email, token, status, expiresAt)
- `InfluencerStorefront` — Curated product showcase
- `InfluencerStorefrontProduct` — Products in storefront
- `InfluencerCommission` — Commission records per sale
- `InfluencerPayout` — Payout records
- `InfluencerCampaign` — Campaign definition
- `InfluencerCampaignAssignment` — Campaign-influencer mapping
- `Referral` — Referral tracking (code, clicks, conversions)
- `ReferralClick` — Click event tracking

### Dependencies
- `DatabaseModule`, `UsersModule`, `ProductsModule`, `OrdersModule`, `PaymentsModule`, `EmailModule`

### Third-Party Integrations
- None (uses platform-internal systems)

### Feature Flags
- `INFLUENCER_PROGRAMME_ENABLED` — Master toggle for influencer features

---

## 8. Finance & Accounting

### Purpose
Handles all financial operations including transaction management, pricing rules, settlements, vendor payouts, commission calculations, fee management, revenue reporting, and accounting integration.

### Status
**Active** — Full financial management suite.

### Key Features
- **Submission pricing workflow** — Set/update pricing on product submissions before publishing
- **Transaction management** — CRUD for PAYMENT, PAYOUT, REFUND, FEE, ADJUSTMENT transactions
- **Transaction backfill** — Idempotent backfill of PAYMENT records from paid orders
- **Refund processing** — Stripe refunds + ledger recording, retry on failure
- **Dispute management** — Stripe chargeback tracking, evidence submission, seller chargeback rate
- **Seller payouts** — Schedule and process vendor payouts
- **Revenue recognition** — Breakdown, monthly recognition, deferred revenue tracking
- **Reconciliation engine** — Batch reconciliation runs comparing internal vs Stripe (only one run at a time; concurrent runs are blocked)
- **Aging reports** — Transaction, settlement, and dispute aging buckets
- **Period close** — Monthly accounting period close/reopen workflow; transactions are rejected when posted to a closed period
- **Settlement automation** — Weekly auto-settlement creation, reservation cleanup, reminder emails
- **Vendor ledger** — Per-vendor running balance with sale/refund/shipping/payout entries
- **Revenue reports** — Daily/weekly/monthly/yearly grouping with seller performance
- **Xero accounting integration** — OAuth, daily journal posting, CoA mapping, three-way recon
- **Invoice generation** — PDF invoices via PDFKit
- **Excel export** — Financial report export via ExcelJS

### User Roles
| Role | Capabilities |
|------|-------------|
| ADMIN | Full financial management, reconciliation, period close |
| FINANCE | Reports, pricing, payouts, settlements, disputes, aging |
| B2C_SELLER / WHOLESALER | View own ledger, balance, settlement history |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/finance/dashboard` | Finance staff dashboard |
| `/finance/pricing` | Submission pricing management |
| `/finance/payouts` | Payout management |
| `/finance/reports/fees` | Fee reports |
| `/finance/reports/revenue` | Revenue reports |
| `/admin/finance` | Admin finance overview |
| `/admin/finance/accounting` | Xero accounting integration |
| `/admin/finance/aging` | Aging reports |
| `/admin/finance/disputes` | Dispute management |
| `/admin/finance/periods` | Accounting period management |
| `/admin/finance/reconciliation` | Reconciliation runs |
| `/admin/finance/revenue` | Revenue recognition |
| `/admin/finance/three-way-recon` | Three-way reconciliation (Platform vs Xero vs Bank) |
| `/admin/pricing` | Admin pricing rules |
| `/admin/settlements` | Settlement management |
| `/admin/discrepancies` | Financial discrepancies |
| `/admin/vendor-ledger` | Vendor ledger management |

### API Endpoints

#### Submission Pricing
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/finance/pending` | Submissions awaiting finance approval |
| POST | `/api/finance/pricing/:submissionId` | Set initial pricing on submission |
| PUT | `/api/finance/pricing/:submissionId` | Update pricing |
| POST | `/api/finance/approve/:submissionId` | Approve submission for publishing |
| POST | `/api/finance/reject/:submissionId` | Reject submission with reason |
| GET | `/api/finance/pricing-history` | All approved pricing records |
| GET | `/api/finance/dashboard/stats` | Finance dashboard statistics |

#### Transactions
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/finance/transactions` | Create transaction |
| GET | `/api/finance/transactions` | List/filter transactions (paginated) |
| GET | `/api/finance/transactions/export` | Export transactions (JSON or CSV) |
| POST | `/api/finance/transactions/backfill` | Backfill PAYMENT records from paid orders |
| GET | `/api/finance/transactions/:id` | Get transaction by ID |
| PUT | `/api/finance/transactions/:id/status` | Update transaction status |

#### Refunds & Disputes
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/finance/refunds` | Process refund for a return (Stripe + ledger) |
| GET | `/api/finance/refunds` | List/filter refunds |
| PUT | `/api/finance/refunds/:id/status` | Update refund status |
| GET | `/api/finance/disputes` | List chargebacks/disputes |
| GET | `/api/finance/disputes/:id` | Get dispute detail |
| PUT | `/api/finance/disputes/:id/status` | Update dispute status |
| PUT | `/api/finance/disputes/:id/evidence-submitted` | Mark evidence submitted |
| GET | `/api/finance/disputes/seller/:sellerId/chargeback-rate` | Seller chargeback rate |

#### Payouts
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/finance/payouts/schedule` | Schedule a seller payout |
| PUT | `/api/finance/payouts/:id/process` | Process a scheduled payout |
| GET | `/api/finance/payouts` | List/filter payouts |
| GET | `/api/finance/payouts/:sellerId/history` | Payout history for a seller |

#### Revenue Recognition & Reports
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/finance/revenue-recognition/breakdown` | Revenue breakdown for date range |
| GET | `/api/finance/revenue-recognition/monthly` | Monthly recognition |
| GET | `/api/finance/revenue-recognition/deferred` | Deferred revenue details |
| GET | `/api/finance/reports/revenue` | Revenue report (grouped) |
| GET | `/api/finance/reports/seller-performance` | Seller performance metrics |
| GET | `/api/finance/reports/customer-spending` | Customer spending analysis |
| GET | `/api/finance/reports/platform-fees` | Platform fee report |

#### Reconciliation & Aging
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/finance/reconciliation/run` | Start reconciliation run |
| GET | `/api/finance/reconciliation/runs` | List runs |
| GET | `/api/finance/reconciliation/runs/:id` | Run detail with items |
| PUT | `/api/finance/reconciliation/items/:id/resolve` | Resolve discrepancy |
| GET | `/api/finance/aging` | Full aging report |
| GET | `/api/finance/aging/transactions` | Transaction aging buckets |
| GET | `/api/finance/aging/settlements` | Settlement aging buckets |
| GET | `/api/finance/aging/disputes` | Dispute aging buckets |

#### Period Close
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/finance/periods` | List accounting periods |
| POST | `/api/finance/periods/close` | Close a month |
| PUT | `/api/finance/periods/reopen` | Reopen a closed period |

#### Settlements
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/settlements` | Create settlement for a seller |
| GET | `/api/settlements` | List settlements |
| GET | `/api/settlements/:id` | Get settlement by ID |
| PUT | `/api/settlements/:id/process` | Process settlement |
| GET | `/api/settlements/calculate/:sellerId` | Calculate settlement amount |
| POST | `/api/settlements/automation/weekly` | Trigger weekly settlement creation |

#### Vendor Ledger
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/vendor-ledger/me` | Seller's own ledger entries |
| GET | `/api/vendor-ledger/me/balance` | Seller's current balance |
| GET | `/api/vendor-ledger/me/summary` | Seller's balance + breakdown |
| GET | `/api/vendor-ledger/:sellerId` | Admin view of vendor ledger |
| GET | `/api/vendor-ledger/:sellerId/summary` | Admin view of vendor summary |

#### Accounting (Xero Integration)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/accounting/status` | Xero connection status |
| GET | `/api/admin/accounting/outbox` | Ledger outbox entries |
| POST | `/api/admin/accounting/outbox/:id/retry` | Retry failed outbox entry |
| POST | `/api/admin/accounting/outbox/drain` | Process all pending entries |
| POST | `/api/admin/accounting/daily-journals/run` | Enqueue daily journals |
| GET | `/api/admin/accounting/coa-mapping` | Chart-of-accounts mapping |
| PUT | `/api/admin/accounting/coa-mapping` | Update CoA mapping |
| GET | `/api/admin/accounting/three-way-recon` | Three-way reconciliation report |
| GET | `/api/admin/accounting/oauth/connect-url` | Generate Xero OAuth URL |
| GET | `/api/admin/accounting/oauth/callback` | Xero OAuth callback |

### Database Models
- `Transaction` — Generic financial transaction (type: PAYMENT/PAYOUT/REFUND/FEE/ADJUSTMENT)
- `TransactionAuditLog` — Status change audit trail
- `Settlement` — Seller payout period summary with platform fees
- `OrderSettlement` — Order amount included in settlement
- `ReconciliationRun` — Batch reconciliation job (internal vs Stripe)
- `ReconciliationItem` — Matched/mismatched reconciliation line
- `Dispute` — Payment chargeback/dispute with Stripe reference
- `FinancialPeriod` — Monthly accounting period with close totals
- `Discrepancy` — Operational mismatch records
- `LedgerOutboxEntry` — Outbox queue for Xero journal posting
- `VendorLedgerEntry` — Per-vendor ledger entry with running balance
- `ProductPricing` — Finance-approved base price, margin, visibility

### Dependencies
- `DatabaseModule`, `PaymentsModule`, `OrdersModule`, `SellersModule`

### Third-Party Integrations
- **Stripe** — Payment processing and refunds
- **PDFKit** — Invoice/report PDF generation
- **ExcelJS** — Financial report Excel export

### Feature Flags
- None identified

---

## 9. Shipping & Fulfillment

### Purpose
Manages shipping rate calculation, carrier integration, fulfillment center operations, warehouse management, shipment tracking, in-store shipping (ship-from-store), courier label generation, and logistics coordination.

### Status
**Active** — Multi-carrier shipping with store shipment for physical outlets.

### Key Features
- **Shipping rate calculation** — Fixed-rate matrix by geographic tier and box size
- **Multi-carrier support** — FedEx, DHL provider adapters
- **Label generation** — Via Shippo integration
- **Geographic tier system** — Domestic US, Near-International, Western Europe & UK, Rest of World
- **Box size management** — SMALL, MEDIUM, LARGE, XL, CUSTOM with configurable pricing
- **Fulfillment center management** — Create and manage fulfillment centers
- **Warehouse management** — Multiple warehouses with inventory tracking
- **Warehouse transfers** — Inter-warehouse stock transfers
- **Shipment tracking** — Real-time tracking number integration
- **Ship-from-store** — In-store shipping workflow for physical outlets
- **Store shipment request lifecycle** — Multi-status workflow (CUSTOMER_DETAILS_REQUIRED → AWAITING_PAYMENT → PAID → PACKING → PACKED → LABEL_CREATED → READY_FOR_PICKUP → HANDED_TO_CARRIER)
- **Multi-destination support** — Split shipment to multiple addresses
- **Carry-in-hand option** — Customers can take some items and ship others
- **QR/magic link claim system** — Customers claim shipping orders on their phones
- **Back office packing workflow** — Chain of custody, item verification, seal/weigh/label
- **Barcode scanning** — Invoice barcode and carrier barcode verification
- **Shipping slip PDF generation**
- **SKU customs data** — HS codes and country of origin for international shipments
- **Staff payment confirmation** — Counter payment (cash/card) or online Stripe payment
- **HOS order numbering** — `HOS-{STORECODE}-{DDMMYY}-{NNNN}` format

### User Roles
| Role | Capabilities |
|------|-------------|
| ADMIN | Rate matrix, box sizes, shipping dashboard, SKU customs |
| FULFILLMENT | Fulfillment center management, shipment processing |
| STORE_STAFF | Create shipping orders, quote boxes, confirm payment, packing |
| CUSTOMER | Claim shipping order, add addresses, assign items, pay |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/admin/shipping-rates` | Shipping rate matrix management |
| `/admin/box-sizes` | Box size configuration |
| `/admin/shipping-dashboard` | Shipping operations dashboard |
| `/admin/store-shipments` | Store shipment monitoring |
| `/admin/sku-customs` | SKU customs data management |
| `/admin/fulfillment-centers` | Fulfillment center management |
| `/admin/warehouses` | Warehouse management |
| `/admin/warehouses/transfers` | Warehouse transfers |
| `/admin/shipments` | Shipment management |
| `/admin/logistics` | Logistics overview |
| `/fulfillment/dashboard` | Fulfillment staff dashboard |
| `/fulfillment/centers` | Fulfillment center management |
| `/fulfillment/shipments` | Shipment management |
| `/fulfillment/shipments/[id]` | Shipment detail |
| `/store/shipping` | Staff shipping counter |
| `/store/shipping/[id]` | Staff shipping order detail |
| `/store/shipping/backoffice` | Back office packing queue |
| `/ship/claim/[token]` | Customer magic link claim |
| `/ship/lookup` | Customer shipping order lookup |
| `/ship/request/[id]` | Customer shipping request page |

### API Endpoints

#### Shipping Rates & Configuration
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/shipping/rates` | Get shipping rates |
| POST | `/api/shipping/calculate` | Calculate shipping cost |
| GET | `/api/shipping/methods` | List shipping methods |
| PUT | `/api/shipping/rates` | Update rate matrix (admin) |
| GET | `/api/shipping/box-sizes` | Get box size configurations |
| POST | `/api/shipping/box-sizes` | Create box size |
| PUT | `/api/shipping/box-sizes/:id` | Update box size |
| DELETE | `/api/shipping/box-sizes/:id` | Delete box size |
| GET | `/api/shipping/tiers` | Get geographic tiers |
| PUT | `/api/shipping/tiers/:id` | Update tier |

#### Courier
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/shipping/courier/rates` | Get carrier rates |
| POST | `/api/shipping/courier/label` | Generate shipping label |
| GET | `/api/shipping/courier/tracking/:trackingNumber` | Track shipment |

#### Store Shipment
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/store-shipment` | Create store shipping order |
| GET | `/api/store-shipment/:id` | Get store shipment details |
| GET | `/api/store-shipment/lookup` | Lookup by HOS number or email |
| POST | `/api/store-shipment/:id/claim` | Customer claim shipping order (single-use token; invalidated after claim) |
| PUT | `/api/store-shipment/:id/profile` | Update customer profile on shipment |
| POST | `/api/store-shipment/:id/assign-items` | Assign items to addresses |
| POST | `/api/store-shipment/:id/quote` | Staff finalize box quote |
| POST | `/api/store-shipment/:id/confirm-payment` | Staff confirm counter payment |
| POST | `/api/store-shipment/:id/pay` | Customer online payment (Stripe; requires finalized box quote) |
| POST | `/api/store-shipment/:id/receive` | Back office scan received |
| POST | `/api/store-shipment/:id/groups/:groupId/seal` | Seal package |
| POST | `/api/store-shipment/:id/groups/:groupId/label` | Generate carrier label |
| POST | `/api/store-shipment/:id/groups/:groupId/verify` | Verify barcodes |
| POST | `/api/store-shipment/:id/carrier-collected` | Mark carrier collected |
| GET | `/api/store-shipment/:id/slip` | Get shipping slip PDF |
| GET | `/api/store-shipment/dashboard` | Shipping dashboard stats |
| GET | `/api/store-shipment/admin/list` | Admin list all store shipments |
| GET | `/api/store-shipment/sku-customs` | Get SKU customs data |
| PUT | `/api/store-shipment/sku-customs/:sku` | Update SKU customs data |

#### Fulfillment
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/fulfillment/centers` | List fulfillment centers |
| POST | `/api/fulfillment/centers` | Create fulfillment center |
| PUT | `/api/fulfillment/centers/:id` | Update center |
| DELETE | `/api/fulfillment/centers/:id` | Delete center |
| GET | `/api/fulfillment/dashboard` | Fulfillment dashboard |

#### Logistics
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/logistics/warehouses` | List warehouses |
| POST | `/api/logistics/warehouses` | Create warehouse |
| PUT | `/api/logistics/warehouses/:id` | Update warehouse |
| POST | `/api/logistics/transfers` | Create warehouse transfer |
| GET | `/api/logistics/transfers` | List transfers |
| PUT | `/api/logistics/transfers/:id` | Update transfer status |

### Database Models
- `ShippingRate` — Rate matrix entries (tier, boxSize, price)
- `ShippingTier` — Geographic tier definitions (name, countries)
- `BoxSize` — Box configurations (name, dimensions, fallbackPrice, active)
- `Shipment` — Shipment tracking records
- `ShipmentItem` — Items in a shipment
- `FulfillmentCenter` — Fulfillment center locations
- `Warehouse` — Warehouse records
- `WarehouseTransfer` — Inter-warehouse transfer records
- `StoreShipmentRequest` — In-store shipping order
- `StoreShipmentGroup` — Shipment group (per destination)
- `StoreShipmentItem` — Individual items in a store shipment
- `StoreShipmentClaim` — Customer claim records with tokens
- `SkuCustomsData` — HS codes and country of origin per SKU

### Dependencies
- `DatabaseModule`, `PaymentsModule`, `InventoryModule`, `PosModule`, `StorageModule`, `NotificationsModule`

### Third-Party Integrations
- **FedEx API** — Shipping rates and label generation
- **DHL API** — Shipping rates and label generation
- **Shippo** — Label generation and tracking for store shipments
- **Stripe** — Online payment for store shipments

### Feature Flags
- `SHIPPING_ONLINE_PAYMENT` — Enable customer online payment for store shipments (vs counter payment)
- `SHIP_FROM_STORE_ENABLED` — Enable in-store shipping feature

---

## 10. Inventory Management

### Purpose
Tracks product stock levels across online and physical store channels, manages stock updates, low-stock alerts, inventory reporting, and discrepancy resolution.

### Status
**Active** — Multi-location inventory with POS sync.

### Key Features
- Stock level tracking per product/variant
- Multi-location inventory (online + per-store)
- Stock reservation on order placement (atomic guard prevents negative stock on confirmation)
- Stock release on order cancellation
- Low-stock threshold alerts
- Out-of-stock auto-status update
- Inventory reports with export
- Discrepancy detection between platform and POS
- Discrepancy resolution workflow
- Bulk stock update capability
- Inventory adjustment logging
- Stock movement history

### User Roles
| Role | Capabilities |
|------|-------------|
| ADMIN | Full inventory management, discrepancy resolution |
| FULFILLMENT | View and update inventory levels |
| B2C_SELLER | Manage own product stock |
| WHOLESALER | Manage own product stock |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/admin/inventory` | Inventory management |
| `/admin/reports/inventory` | Inventory reports |
| `/admin/discrepancies` | Discrepancy management |

### API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/inventory` | List inventory levels |
| GET | `/api/inventory/:productId` | Get product inventory |
| PUT | `/api/inventory/:productId` | Update stock level |
| POST | `/api/inventory/bulk-update` | Bulk stock update |
| GET | `/api/inventory/low-stock` | Get low-stock products |
| GET | `/api/inventory/report` | Inventory report |
| GET | `/api/inventory/movements/:productId` | Stock movement history |
| GET | `/api/discrepancies` | List discrepancies |
| GET | `/api/discrepancies/:id` | Get discrepancy details |
| PUT | `/api/discrepancies/:id/resolve` | Resolve discrepancy |

### Database Models
- `Inventory` — Stock level per product/location
- `InventoryMovement` — Stock change history (type, quantity, reason)
- `InventoryReservation` — Reserved stock for pending orders
- `StockAlert` — Low-stock alert records
- `Discrepancy` — Platform vs POS stock discrepancies

### Dependencies
- `DatabaseModule`, `ProductsModule`, `PosModule`, `NotificationsModule`

### Third-Party Integrations
- **Lightspeed POS** — Bidirectional inventory sync

### Feature Flags
- None identified

---

## 11. Marketing & CRM

### Purpose
Manages marketing campaigns, newsletter subscriptions, customer journey automation, audience segmentation, social sharing, and promotional communications.

### Status
**Active** — Marketing tools with journey automation and segmentation engine.

### Key Features
- Marketing campaign management (create, schedule, track)
- Newsletter subscription management
- Customer journey automation (welcome, post-purchase, re-engagement, birthday, tier upgrade)
- Rule-based audience segmentation engine
- Dynamic segment auto-updating
- Pre-built segment templates (VIP at risk, Rising stars, Fandom enthusiasts)
- Segment by: fandom affinity, spend tier, engagement level, geography, product affinity
- Tourist vs local detection
- Social sharing tracking and rewards
- Marketing materials management
- Campaign analytics and attribution
- Email template management
- Bulk email sending
- Newsletter subscription/unsubscription

### User Roles
| Role | Capabilities |
|------|-------------|
| ADMIN | Full marketing management |
| MARKETING | Campaign creation, newsletter, materials, segmentation |
| CUSTOMER | Newsletter subscription, social sharing |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/marketing/dashboard` | Marketing staff dashboard |
| `/marketing/materials` | Marketing materials |
| `/marketing/campaigns` | Campaign management |
| `/admin/marketing` | Admin marketing overview |
| `/admin/newsletter` | Newsletter management |

### API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/marketing/campaigns` | List campaigns |
| POST | `/api/marketing/campaigns` | Create campaign |
| GET | `/api/marketing/campaigns/:id` | Get campaign details |
| PUT | `/api/marketing/campaigns/:id` | Update campaign |
| DELETE | `/api/marketing/campaigns/:id` | Delete campaign |
| GET | `/api/marketing/materials` | List marketing materials |
| POST | `/api/marketing/materials` | Upload material |
| GET | `/api/marketing/dashboard` | Marketing dashboard stats |
| GET | `/api/newsletter` | List subscribers |
| POST | `/api/newsletter/subscribe` | Subscribe to newsletter |
| POST | `/api/newsletter/unsubscribe` | Unsubscribe |
| GET | `/api/newsletter/stats` | Newsletter statistics |
| POST | `/api/social-sharing/share` | Record social share |
| GET | `/api/social-sharing/stats` | Sharing statistics |
| GET | `/api/segmentation/segments` | List segments |
| POST | `/api/segmentation/segments` | Create segment |
| PUT | `/api/segmentation/segments/:id` | Update segment |
| DELETE | `/api/segmentation/segments/:id` | Delete segment |
| GET | `/api/segmentation/segments/:id/members` | Get segment members |
| POST | `/api/segmentation/evaluate` | Evaluate segment rules |
| GET | `/api/segmentation/templates` | Get pre-built templates |
| GET | `/api/journeys` | List marketing journeys |
| POST | `/api/journeys` | Create journey |
| PUT | `/api/journeys/:id` | Update journey |
| DELETE | `/api/journeys/:id` | Delete journey |
| POST | `/api/journeys/:id/activate` | Activate journey |
| POST | `/api/journeys/:id/pause` | Pause journey |

### Database Models
- `MarketingCampaign` — Campaign records (name, type, status, audience, schedule)
- `NewsletterSubscription` — Email subscription records
- `SharedItem` — Social sharing records (productId, platform, userId)
- `CustomerSegment` — Segment definitions with rules
- `CustomerSegmentMember` — Segment membership
- `MarketingJourney` — Journey automation definitions
- `JourneyStep` — Individual journey steps
- `JourneyExecution` — Journey execution tracking
- `MarketingMaterial` — Uploaded marketing assets

### Dependencies
- `DatabaseModule`, `EmailModule`, `NotificationsModule`, `UsersModule`, `LoyaltyModule`

### Third-Party Integrations
- **Nodemailer / SMTP** — Email campaign delivery
- **Twilio** — WhatsApp and SMS campaign delivery

### Feature Flags
- `JOURNEY_AUTOMATION_ENABLED` — Enable marketing journey automation
- `SEGMENTATION_ENGINE_ENABLED` — Enable audience segmentation

---

## 12. Content Management (CMS)

### Purpose
Manages website content including landing pages, banners, blog posts, media library, navigation menus, testimonials, galleries, and templates. Integrates with Strapi headless CMS for content authoring.

### Status
**Active** — Full CMS with Strapi integration and standalone content management.

### Key Features
- Page creation and management (landing pages, custom pages)
- Banner and carousel management (hero banners, promotional)
- Blog content management (create, edit, publish, categories)
- Media library (image upload and management)
- Navigation menu management (header, footer, sidebar menus)
- Testimonials management (customer quotes)
- Gallery management (image galleries)
- Template system (reusable content templates)
- CMS settings configuration
- Strapi integration for headless content
- Cache revalidation webhook from Strapi
- Content publishing workflow
- SEO metadata for all content
- Rich text editing

### User Roles
| Role | Capabilities |
|------|-------------|
| ADMIN | Full CMS management |
| CMS_EDITOR | Page, banner, blog, media, navigation management |
| CUSTOMER | View published content |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/cms/dashboard` | CMS editor dashboard |
| `/cms/pages` | Page management |
| `/cms/banners` | Banner management |
| `/cms/blog` | Blog management |
| `/cms/media` | Media library |
| `/cms/settings` | CMS settings |
| `/blog` | Public blog listing |
| `/blog/[slug]` | Blog post detail |
| `/pages/[slug]` | Dynamic CMS pages |

### API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/cms/pages` | List CMS pages |
| POST | `/api/cms/pages` | Create CMS page |
| GET | `/api/cms/pages/:id` | Get page details |
| PUT | `/api/cms/pages/:id` | Update page |
| DELETE | `/api/cms/pages/:id` | Delete page |
| GET | `/api/cms/banners` | List banners |
| POST | `/api/cms/banners` | Create banner |
| PUT | `/api/cms/banners/:id` | Update banner |
| DELETE | `/api/cms/banners/:id` | Delete banner |
| GET | `/api/cms/settings` | Get CMS settings |
| PUT | `/api/cms/settings` | Update CMS settings |
| POST | `/api/cms/revalidate` | Revalidate cache (webhook) |
| GET | `/api/blog` | List blog posts |
| POST | `/api/blog` | Create blog post |
| GET | `/api/blog/:slug` | Get blog post |
| PUT | `/api/blog/:id` | Update blog post |
| DELETE | `/api/blog/:id` | Delete blog post |
| GET | `/api/templates` | List templates |
| POST | `/api/templates` | Create template |
| PUT | `/api/templates/:id` | Update template |
| DELETE | `/api/templates/:id` | Delete template |
| GET | `/api/gallery` | List galleries |
| POST | `/api/gallery` | Create gallery |
| PUT | `/api/gallery/:id` | Update gallery |
| DELETE | `/api/gallery/:id` | Delete gallery |
| GET | `/api/testimonials` | List testimonials |
| POST | `/api/testimonials` | Create testimonial |
| PUT | `/api/testimonials/:id` | Update testimonial |
| DELETE | `/api/testimonials/:id` | Delete testimonial |
| GET | `/api/navigation` | Get navigation menus |
| PUT | `/api/navigation` | Update navigation menus |

### Database Models
- `CMSPage` — Content pages (title, slug, content, status, seo)
- `Banner` — Banner/carousel entries (title, imageUrl, linkUrl, position, active)
- `BlogPost` — Blog content (title, slug, content, author, publishedAt, category)
- `MediaAsset` — Media library items (url, filename, type, size)
- `Template` — Reusable content templates
- `Gallery` — Image gallery records
- `GalleryImage` — Images within galleries
- `Testimonial` — Customer testimonial records
- `NavigationMenu` — Navigation menu definitions
- `NavigationItem` — Menu items with hierarchy

### Dependencies
- `DatabaseModule`, `UploadsModule`, `StorageModule`, `CacheModule`

### Third-Party Integrations
- **Strapi** — Headless CMS content authoring
- **Cloudinary** — Image optimization for media library

### Feature Flags
- None identified

---

## 13. Gamification (Quests, Badges, Leaderboard)

### Purpose
Implements the gamification layer including badge achievements, quest system, leaderboards, fandom quizzes, and gamification points — driving customer engagement and retention.

### Status
**Active** — Badges, quests, leaderboard, and quiz systems operational.

### Key Features
- **Badge system** — Achievement badges awarded for milestones and actions
- **Quest system** — Multi-step quests with point rewards (50–500 pts)
- **Leaderboard** — Platform-wide and per-fandom leaderboards
- **Fandom quizzes** — Interactive quizzes with point rewards (25 pts, weekly limit)
- **Gamification points** — Separate from loyalty points; used for levels and leaderboard ranking
- **Level progression** — Experience-based level system
- **User profiles** — Gamification stats (level, points, badges earned, quests completed)
- **Admin quest management** — Create, edit, activate quests
- **Admin badge management** — Define badges and award criteria
- **Quest types** — Purchase-based, engagement-based, fandom-specific
- **Badge categories** — Achievement, milestone, fandom, seasonal
- **Automated badge awarding** — Event-driven badge unlocking

### User Roles
| Role | Capabilities |
|------|-------------|
| CUSTOMER | Complete quests, earn badges, view leaderboard, take quizzes |
| ADMIN | Manage quests, badges, leaderboard configuration |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/quests` | Quest listing and progress |
| `/quests/[id]` | Quest detail and completion |
| `/leaderboard` | Platform leaderboard |
| `/badges` | Badge collection |
| `/admin/gamification` | Admin gamification dashboard |
| `/admin/gamification/quests` | Quest management |
| `/admin/gamification/badges` | Badge management |

### API Endpoints

#### Gamification Core
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/gamification/profile` | Get user gamification profile |
| GET | `/api/gamification/leaderboard` | Get leaderboard |
| GET | `/api/gamification/points` | Get gamification points |
| POST | `/api/gamification/points/award` | Award points |
| GET | `/api/gamification/levels` | Get level definitions |

#### Badges
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/badges` | List available badges |
| GET | `/api/badges/user` | Get user's earned badges |
| POST | `/api/badges` | Create badge (admin) |
| PUT | `/api/badges/:id` | Update badge (admin) |
| DELETE | `/api/badges/:id` | Delete badge (admin) |
| POST | `/api/badges/award` | Award badge to user |

#### Quests
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/quests` | List available quests |
| GET | `/api/quests/:id` | Get quest details |
| POST | `/api/quests` | Create quest (admin) |
| PUT | `/api/quests/:id` | Update quest (admin) |
| DELETE | `/api/quests/:id` | Delete quest (admin) |
| POST | `/api/quests/:id/start` | Start quest |
| POST | `/api/quests/:id/progress` | Update quest progress |
| POST | `/api/quests/:id/complete` | Complete quest |
| GET | `/api/quests/user` | Get user's quest status |

#### Quiz
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/quiz` | List available quizzes |
| GET | `/api/quiz/:id` | Get quiz questions |
| POST | `/api/quiz/:id/submit` | Submit quiz answers |
| POST | `/api/quiz` | Create quiz (admin) |
| PUT | `/api/quiz/:id` | Update quiz (admin) |
| DELETE | `/api/quiz/:id` | Delete quiz (admin) |

### Database Models
- `UserBadge` — Badge earned by user (userId, badgeId, earnedAt)
- `Badge` — Badge definition (name, description, icon, criteria, category)
- `UserQuest` — User quest progress (userId, questId, status, progress)
- `Quest` — Quest definition (name, description, steps, reward, fandom)
- `QuestStep` — Individual quest step
- `GamificationProfile` — User gamification stats (level, totalPoints)
- `FandomQuiz` — Quiz definition (fandom, questions, pointReward)
- `QuizAttempt` — User quiz attempt record
- `LeaderboardEntry` — Leaderboard rankings (computed/cached)

### Dependencies
- `DatabaseModule`, `UsersModule`, `LoyaltyModule`, `NotificationsModule`

### Third-Party Integrations
- None (platform-internal)

### Feature Flags
- `GAMIFICATION_ENABLED` — Master toggle for gamification features
- `QUESTS_ENABLED` — Enable quest system
- `QUIZZES_ENABLED` — Enable fandom quizzes

---

## 14. Access Control & Permissions

### Purpose
Implements fine-grained role-based access control (RBAC) with both static roles (enum-based) and dynamic custom permission roles stored in the database. Controls access to all API endpoints and frontend routes.

### Status
**Active** — Core security module used across all endpoints.

### Key Features
- **13 static user roles:** CUSTOMER, ADMIN, B2C_SELLER, WHOLESALER, INFLUENCER, PROCUREMENT, FULFILLMENT, CATALOG, MARKETING, FINANCE, CMS_EDITOR, SALES, STORE_STAFF
- **Custom permission roles** — Fine-grained, DB-stored with JSON permission arrays
- **85 granular permissions** across 14 categories (Products, Orders, Users, Sellers, Business Ops, Fulfillment, Finance, Marketing, Influencers, Loyalty, Stores, System)
- **4 scope types:** GLOBAL, MARKET, TENANT, STORE (plus SELF for ownership checks)
- **3 access control modes:** `legacy` (old @Roles behavior), `shadow` (logs divergences), `enforce` (new policy engine)
- **Route-level decorators:** `@Roles()`, `@Permissions()`, `@RequireAccess({ permission, scope })`, `@Public()`
- **Global guards:** `JwtAuthGuard` (authentication) → `AccessGuard` (authorization), both registered as `APP_GUARD`
- **Ownership policies:** `sellerOwnsOrder`, `customerOwnsOrder`, `userOwnsRecord`, `staffOwnsStore`
- **Market context:** Via `x-market-code` header, propagated via AsyncLocalStorage
- **System actors:** `withSystemActor()` for background jobs/webhooks/cron
- **Permission wildcard support:** `*` (all), `resource.*` (resource-level wildcard)
- **Role assignment caching:** 15-second TTL with invalidation on changes
- **Built-in default permissions** for all 13 static roles

### User Roles
| Role | Capabilities |
|------|-------------|
| ADMIN | Full access, permission role management, impersonation |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/admin/permissions` | Permission role management |
| `/admin/users` | User role assignment |

### API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/access-control/me` | Effective permissions, assignments, visible markets for current user |
| GET | `/api/access-control/catalog` | Canonical permission catalog (85 permissions) |
| GET | `/api/access-control/markets` | Markets the caller may access |
| GET | `/api/access-control/roles` | List permission roles |
| PUT | `/api/access-control/roles/:id` | Update role permissions and scope kind |
| GET | `/api/access-control/assignments` | List role assignments for a user (`?userId=`) |
| POST | `/api/access-control/assignments` | Create role assignment (scope: GLOBAL/MARKET/TENANT/STORE) |
| DELETE | `/api/access-control/assignments/:id` | Delete assignment; bumps user's `tokenVersion` |
| GET | `/api/access-control/stores` | List stores for scope assignment picker |
| GET | `/api/access-control/admin/markets` | List all markets (incl. inactive) |
| POST | `/api/access-control/admin/markets` | Create market |
| PUT | `/api/access-control/admin/markets/:id` | Update market |

### Permission Catalog (85 permissions, grouped by category)

| Category | Permissions |
|----------|------------|
| Products | `products.view`, `products.create`, `products.edit`, `products.delete`, `products.publish` |
| Orders | `orders.view`, `orders.manage`, `orders.cancel`, `orders.refund`, `orders.accept` |
| Users | `users.view`, `users.create`, `users.edit`, `users.delete`, `users.manage`, `users.roles` |
| Sellers | `sellers.view`, `sellers.approve`, `sellers.suspend`, `sellers.operate` |
| Business Ops | `submissions.review`, `submissions.approve`, `submissions.reject`, `catalog.create`, `catalog.manage`, `pricing.approve`, `procurement.view`, `procurement.manage` |
| Fulfillment | `shipments.verify`, `fulfillment.view`, `fulfillment.manage`, `shipping.view`, `shipping.manage`, `inventory.view`, `inventory.manage` |
| Finance | `finance.view`, `finance.manage`, `finance.payouts`, `finance.reconciliation`, `settlements.view`, `settlements.manage`, `cancellations.view`, `cancellations.review`, `returns.view`, `returns.manage`, `invoices.view`, `gift-cards.view`, `gift-cards.manage`, `tax.view`, `tax.manage` |
| Marketing | `marketing.create`, `marketing.manage`, `promotions.view`, `promotions.manage`, `cms.edit` |
| Influencers | `influencers.view`, `influencers.manage` |
| Loyalty/Stores | `loyalty.view`, `loyalty.manage`, `stores.view`, `stores.manage`, `stores.operate` |
| System | `system.settings`, `system.themes`, `system.permissions`, `system.analytics`, `tenants.view`, `tenants.manage`, `markets.view`, `markets.manage`, `support.view`, `support.manage`, `uploads.manage`, `webhooks.manage` |

### Database Models
- `PermissionRole` — Custom permission role (name, description, permissions[], scopeKind)
- `UserRoleAssignment` — Scoped role assignment (userId, roleId, scopeType, scopeId)
- `Market` — First-class selling market with currency and locale

### Dependencies
- `DatabaseModule`, `UsersModule`, `CacheModule`

### Third-Party Integrations
- None (platform-internal security)

### Feature Flags
- None (always active)

---

## 15. Notifications & Messaging

### Purpose
Handles all platform notifications including in-app notifications, transactional emails, WhatsApp messaging, and newsletter communications. Uses BullMQ for async email queuing.

### Status
**Active** — Multi-channel notification delivery.

### Key Features
- **In-app notifications** — Real-time notification bell with unread count
- **Email notifications** — Transactional emails via SMTP/Nodemailer
- **WhatsApp messaging** — Via Twilio WhatsApp API
- **Email queueing** — BullMQ for async email processing
- **Email templates** — HTML email templates for various events
- **Notification preferences** — Per-user notification settings
- **Bulk notifications** — Send to user segments
- **Notification types** — Order updates, loyalty events, promotional, system alerts
- **Read/unread tracking** — Mark notifications as read
- **WhatsApp conversation tracking** — Conversation history
- **WhatsApp webhook** — Incoming message handling

### User Roles
| Role | Capabilities |
|------|-------------|
| ALL ROLES | Receive and manage notifications |
| ADMIN | Send bulk notifications, manage WhatsApp |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/notifications` | Notification center |
| `/admin/whatsapp` | WhatsApp management |
| `/admin/newsletter` | Newsletter management |

### API Endpoints

#### Notifications
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/notifications` | List user notifications |
| GET | `/api/notifications/unread-count` | Get unread count |
| PUT | `/api/notifications/:id/read` | Mark as read |
| PUT | `/api/notifications/read-all` | Mark all as read |
| DELETE | `/api/notifications/:id` | Delete notification |
| POST | `/api/notifications/send` | Send notification (admin) |
| POST | `/api/notifications/bulk` | Send bulk notification (admin) |

#### Email
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/email/send` | Send email (internal) |
| GET | `/api/email/templates` | List email templates |
| PUT | `/api/email/templates/:id` | Update email template |

#### WhatsApp
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/whatsapp/send` | Send WhatsApp message |
| GET | `/api/whatsapp/conversations` | List conversations |
| GET | `/api/whatsapp/conversations/:id` | Get conversation messages |
| POST | `/api/whatsapp/webhook` | Incoming message webhook |

### Database Models
- `Notification` — In-app notification records (userId, type, title, message, read, data)
- `EmailLog` — Email sending records
- `WhatsAppConversation` — Conversation threads
- `WhatsAppMessage` — Individual messages
- `NotificationPreference` — Per-user notification settings

### Dependencies
- `DatabaseModule`, `QueueModule`, `CacheModule`

### Third-Party Integrations
- **Nodemailer** — SMTP email sending
- **Twilio** — WhatsApp messaging API
- **BullMQ** — Async email job queue

### Feature Flags
- `WHATSAPP_ENABLED` — Enable WhatsApp messaging

---

## 16. Gift Cards

### Purpose
Manages the gift card system including issuance, balance management, redemption at checkout, POS-issued loyalty vouchers, and reconciliation with Lightspeed.

### Status
**Active** — Digital gift cards with POS voucher integration.

### Key Features
- Gift card issuance (admin-issued with amount, type, recipient)
- Gift card types: Digital, Physical
- Gift card code format: `XXXX-XXXX-XXXX-XXXX` (cryptographically random via `crypto.randomInt`)
- Denominations: $25, $50, $100, $250, $500
- Balance tracking (partial redemptions supported)
- Checkout redemption (apply code on payment page)
- Combined payment (gift card + Stripe for remainder)
- Status lifecycle: ACTIVE → REDEEMED / EXPIRED / CANCELLED
- Auto-restore balance on order cancellation
- Admin manual refund capability
- POS loyalty voucher creation (loyalty points → Lightspeed gift card)
- 6-hourly POS gift card reconciliation
- Gift card catalog pages
- Public code validation (does not reveal balance for security)

### User Roles
| Role | Capabilities |
|------|-------------|
| CUSTOMER | Purchase, redeem, check balance |
| ADMIN | Issue, manage, refund, reconcile |
| STORE_STAFF | POS voucher creation via loyalty redemption |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/gift-cards` | Gift card catalog |
| `/gift-cards/purchase` | Purchase gift card |
| `/gift-cards/[id]` | Gift card detail |
| `/admin/gift-cards` | Admin gift card management |

### API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/gift-cards` | List gift cards |
| POST | `/api/gift-cards` | Issue gift card (admin) |
| GET | `/api/gift-cards/:id` | Get gift card details |
| PUT | `/api/gift-cards/:id` | Update gift card |
| DELETE | `/api/gift-cards/:id` | Cancel gift card |
| POST | `/api/gift-cards/validate` | Validate code (public; returns `hasBalance` boolean, not exact balance) |
| POST | `/api/gift-cards/redeem` | Redeem at checkout |
| POST | `/api/gift-cards/:id/refund` | Refund gift card redemption |
| GET | `/api/gift-cards/user` | Get user's gift cards |
| POST | `/api/gift-cards/pos-voucher` | Create POS voucher from loyalty points |
| GET | `/api/gift-cards/reconciliation` | Get reconciliation results |

### Database Models
- `GiftCard` — Gift card record (code, initialBalance, currentBalance, status, type, recipientEmail, expiresAt)
- `GiftCardTransaction` — Redemption and refund transactions
- `GiftCardReconciliation` — POS reconciliation records
- `PosGiftCard` — POS-issued gift card tracking

### Dependencies
- `DatabaseModule`, `PaymentsModule`, `PosModule`, `NotificationsModule`

### Third-Party Integrations
- **Stripe** — Gift card purchase payment
- **Lightspeed POS** — POS gift card/voucher sync and reconciliation

### Feature Flags
- `GIFT_CARDS_ENABLED` — Enable gift card features

---

## 17. Search (Meilisearch)

### Purpose
Provides full-text product search with instant results, typo tolerance, faceted filtering, and admin index management via Meilisearch search engine.

### Status
**Active** — Meilisearch v1.11 powering product search.

### Key Features
- Full-text product search with instant results
- Typo tolerance and fuzzy matching
- Faceted search and filtering (fandom, category, price range, seller)
- Search suggestions / autocomplete
- Product indexing (automatic on create/update)
- Index management (admin)
- Search analytics (popular queries)
- Filterable and sortable attributes configuration
- Ranking rules customization
- Synonyms configuration
- Bulk re-indexing
- Multi-index support

### User Roles
| Role | Capabilities |
|------|-------------|
| ALL USERS | Search products |
| ADMIN | Index management, search configuration |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/products` | Search results integrated into product listing |
| `/admin/search` | Meilisearch index management |
| Header SearchBar | Global search input component |

### API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/meilisearch/search` | Search products |
| POST | `/api/meilisearch/index` | Index/re-index products |
| GET | `/api/meilisearch/stats` | Index statistics |
| POST | `/api/meilisearch/settings` | Update search settings |
| GET | `/api/meilisearch/settings` | Get search settings |
| DELETE | `/api/meilisearch/index` | Delete index |
| POST | `/api/meilisearch/synonyms` | Update synonyms |
| GET | `/api/meilisearch/health` | Health check |

### Database Models
- None (search index is external to the database)
- Products table is the data source for indexing

### Dependencies
- `DatabaseModule`, `ProductsModule`

### Third-Party Integrations
- **Meilisearch v1.11** — Full-text search engine

### Feature Flags
- None (core search is always active)

---

## 18. Integrations Framework

### Purpose
Provides a catalog-driven framework for configuring third-party service integrations (shipping, tax, email providers) and managing outbound webhooks for event notifications.

### Status
**Active** — Integration catalog with webhook management.

### Key Features
- Integration catalog with metadata-driven configuration
- Supported integration categories: Shipping, Tax, Email, POS
- Available integrations: USPS, Avalara, TaxJar, SendGrid, FedEx, DHL
- Admin integration configuration UI
- API key and credential management
- Integration health monitoring
- Outbound webhook management
- Webhook event types: order.created, order.updated, product.created, payment.received, etc.
- Webhook retry logic with exponential backoff
- Webhook delivery logs
- Webhook secret signing for verification

### User Roles
| Role | Capabilities |
|------|-------------|
| ADMIN | Integration configuration, webhook management |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/admin/settings/integrations` | Integration configuration |
| `/admin/webhooks` | Webhook management |

### API Endpoints

#### Integrations
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/integrations` | List available integrations |
| GET | `/api/integrations/:id` | Get integration details |
| PUT | `/api/integrations/:id` | Configure integration |
| POST | `/api/integrations/:id/test` | Test integration connection |
| GET | `/api/integrations/:id/health` | Check integration health |

#### Webhooks
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/webhooks` | List webhooks |
| POST | `/api/webhooks` | Create webhook |
| GET | `/api/webhooks/:id` | Get webhook details |
| PUT | `/api/webhooks/:id` | Update webhook |
| DELETE | `/api/webhooks/:id` | Delete webhook |
| GET | `/api/webhooks/:id/deliveries` | Get delivery logs |
| POST | `/api/webhooks/:id/test` | Send test payload |

### Database Models
- `Integration` — Integration configuration (provider, category, config, enabled)
- `Webhook` — Webhook registration (url, events[], secret, active)
- `WebhookDelivery` — Delivery attempt log (webhookId, event, payload, statusCode, responseBody)

### Dependencies
- `DatabaseModule`, `CacheModule`, `QueueModule`

### Third-Party Integrations
- Varies by configured integration (USPS, Avalara, TaxJar, SendGrid, etc.)

### Feature Flags
- None identified

---

## 19. Analytics & Reporting

### Purpose
Provides platform-wide analytics dashboards, financial reports, user reports, product reports, inventory reports, and seller analytics with data export capabilities.

### Status
**Active** — Comprehensive reporting suite.

### Key Features
- Platform analytics dashboard (orders, revenue, users, products)
- Seller analytics (per-seller performance)
- Financial reports (sales, revenue, fees, commissions)
- User reports (registrations, activity, retention)
- Product reports (top sellers, category performance, views)
- Inventory reports (stock levels, movement, low-stock)
- Order reports (status distribution, fulfillment times)
- Dashboard KPIs with period comparison (daily, weekly, monthly)
- Chart data for visual dashboards (Recharts)
- Data export (Excel via ExcelJS, CSV)
- Real-time monitoring dashboard
- Performance metrics tracking
- Error rate monitoring via Sentry

### User Roles
| Role | Capabilities |
|------|-------------|
| ADMIN | Full analytics access, all reports |
| FINANCE | Financial reports |
| MARKETING | Campaign and user analytics |
| B2C_SELLER | Own seller analytics |
| WHOLESALER | Own seller analytics |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/admin/dashboard` | Admin main dashboard |
| `/admin/reports` | Reports overview |
| `/admin/reports/sales` | Sales reports |
| `/admin/reports/users` | User reports |
| `/admin/reports/products` | Product reports |
| `/admin/reports/platform` | Platform reports |
| `/admin/reports/inventory` | Inventory reports |
| `/seller/analytics` | Seller analytics dashboard |
| `/customer/dashboard` | Customer personal dashboard |

### API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/analytics/overview` | Platform overview stats |
| GET | `/api/analytics/sales` | Sales analytics |
| GET | `/api/analytics/users` | User analytics |
| GET | `/api/analytics/products` | Product analytics |
| GET | `/api/analytics/revenue` | Revenue analytics |
| GET | `/api/analytics/orders` | Order analytics |
| GET | `/api/analytics/export` | Export analytics data |
| GET | `/api/dashboard` | Aggregated dashboard data |
| GET | `/api/dashboard/kpis` | Key performance indicators |
| GET | `/api/dashboard/charts` | Chart data |
| GET | `/api/dashboard/seller` | Seller dashboard data |
| GET | `/api/monitoring/health` | System health check |
| GET | `/api/monitoring/metrics` | Performance metrics |

### Database Models
- `AnalyticsEvent` — Analytics event records
- `DashboardCache` — Cached dashboard data
- No dedicated analytics tables — reports are computed from Order, Transaction, User, Product tables

### Dependencies
- `DatabaseModule`, `OrdersModule`, `UsersModule`, `ProductsModule`, `CacheModule`

### Third-Party Integrations
- **Sentry** — Error tracking and performance monitoring
- **ExcelJS** — Report export to Excel
- **Recharts** — Frontend charting library

### Feature Flags
- None identified

---

## 20. Support & Help

### Purpose
Manages customer support through a ticket system with messaging, knowledge base articles, and optional AI chatbot integration.

### Status
**Active** — Ticket-based support system.

### Key Features
- Support ticket creation and management
- Ticket messaging with threaded replies
- Ticket priority levels (Low, Medium, High, Urgent)
- Ticket status lifecycle: OPEN → IN_PROGRESS → WAITING → RESOLVED → CLOSED
- Ticket categories (Order, Product, Account, Shipping, Return, Other)
- Knowledge base articles
- Knowledge base categories and search
- Admin ticket dashboard
- Ticket assignment to staff
- Customer ticket history
- Internal notes on tickets
- File attachments on tickets

### User Roles
| Role | Capabilities |
|------|-------------|
| CUSTOMER | Create tickets, view own tickets, reply |
| ADMIN | Full ticket management, knowledge base management |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/support/new` | Create new ticket |
| `/support/tickets` | My tickets list |
| `/support/tickets/[id]` | Ticket detail and messaging |
| `/support/kb` | Knowledge base |
| `/support/kb/[slug]` | Knowledge base article |
| `/admin/support` | Admin ticket management |

### API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/support/tickets` | Create ticket |
| GET | `/api/support/tickets` | List tickets |
| GET | `/api/support/tickets/:id` | Get ticket details |
| PUT | `/api/support/tickets/:id` | Update ticket |
| POST | `/api/support/tickets/:id/messages` | Add message to ticket |
| PUT | `/api/support/tickets/:id/assign` | Assign ticket to staff |
| PUT | `/api/support/tickets/:id/status` | Update ticket status |
| GET | `/api/support/kb` | List knowledge base articles |
| GET | `/api/support/kb/:slug` | Get KB article |
| POST | `/api/support/kb` | Create KB article (admin) |
| PUT | `/api/support/kb/:id` | Update KB article (admin) |
| DELETE | `/api/support/kb/:id` | Delete KB article (admin) |
| GET | `/api/support/kb/search` | Search knowledge base |
| GET | `/api/support/dashboard` | Support dashboard stats (admin) |

### Database Models
- `SupportTicket` — Ticket record (userId, subject, category, priority, status, assigneeId)
- `TicketMessage` — Message within ticket thread
- `KnowledgeBaseArticle` — Help article (title, slug, content, category, published)
- `KnowledgeBaseCategory` — Article categories
- `TicketAttachment` — File attachments on tickets

### Dependencies
- `DatabaseModule`, `UsersModule`, `NotificationsModule`, `EmailModule`

### Third-Party Integrations
- None (platform-internal)

### Feature Flags
- None identified

---

## 21. GDPR & Privacy

### Purpose
Implements GDPR and privacy compliance including consent management, data processing records, consent logs, data export/deletion requests, and compliance auditing.

### Status
**Active** — GDPR consent management and compliance controls.

### Key Features
- GDPR consent banner tracking
- Cookie consent management
- Data processing consent collection
- Consent log auditing
- Privacy preference management
- Data export request ("Right to Access")
- Data deletion request ("Right to Erasure") — deletes profile, orders, reviews, notifications, newsletter subscriptions, support tickets, and all non-essential records; consent logs anonymized but retained for audit
- Consent revocation
- "Do Not Sell" compliance (CCPA)
- Privacy audit dashboard (admin)
- Data processing records
- Compliance report generation
- Region-aware privacy rules (GDPR for UK/EU, CCPA for US)

### User Roles
| Role | Capabilities |
|------|-------------|
| CUSTOMER | Manage consent, request data export/deletion |
| ADMIN | Privacy audit, compliance management, data processing oversight |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/privacy` | Privacy policy page |
| `/do-not-sell` | Do Not Sell page (CCPA) |
| `/admin/privacy-audit` | Privacy audit dashboard |
| `/admin/compliance` | Compliance management |

### API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/gdpr/consent` | Record user consent |
| GET | `/api/gdpr/consent` | Get user's consent status |
| PUT | `/api/gdpr/consent` | Update consent preferences |
| DELETE | `/api/gdpr/consent` | Revoke consent |
| GET | `/api/gdpr/consent-log` | Get consent audit log |
| POST | `/api/gdpr/data-export` | Request data export |
| POST | `/api/gdpr/data-deletion` | Request data deletion |
| GET | `/api/gdpr/data-export/:id` | Get export status |
| GET | `/api/compliance/records` | Data processing records |
| POST | `/api/compliance/records` | Create processing record |
| GET | `/api/compliance/audit` | Compliance audit report |
| GET | `/api/compliance/dashboard` | Compliance dashboard |

### Database Models
- `GDPRConsentLog` — Consent event audit trail (userId, consentType, granted, timestamp, ipAddress)
- `DataProcessingRecord` — Data processing activity records
- `DataExportRequest` — Data export request tracking
- `DataDeletionRequest` — Data deletion request tracking

### Dependencies
- `DatabaseModule`, `UsersModule`

### Third-Party Integrations
- None (platform-internal)

### Feature Flags
- `GDPR_CONSENT_BANNER` — Show GDPR consent banner
- `CCPA_DO_NOT_SELL` — Enable CCPA "Do Not Sell" functionality

---

## 22. Store Operations (Ship-from-Store, Store Staff)

### Purpose
Manages physical store operations including staff management, store administration, in-store shipping workflows, store-specific inventory, and store dashboard analytics.

### Status
**Active** — Store operations live for HOS physical outlets.

### Key Features
- Store administration (create, configure, manage stores)
- Store staff management (assign staff to stores, roles)
- Staff-locked store access (STORE_STAFF only sees their assigned store)
- In-store shipping counter workflow (see Module 9 for full details)
- Back office packing queue and workflow
- Store-specific dashboard with daily metrics
- Store-specific inventory views
- Store code assignment for HOS order numbers
- Multi-store support (UK stores + NYC Times Square)
- POS connection per store
- Store-level reporting

### User Roles
| Role | Capabilities |
|------|-------------|
| ADMIN | Store creation, configuration, staff assignment |
| STORE_STAFF | Shipping counter, back office packing, loyalty lookup |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/store/shipping` | Shipping counter |
| `/store/shipping/[id]` | Shipping order detail (staff) |
| `/store/shipping/backoffice` | Back office packing queue |
| `/store/lookup` | Loyalty member lookup |
| `/admin/stores` | Store management |

### API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/stores` | List stores |
| POST | `/api/stores` | Create store |
| GET | `/api/stores/:id` | Get store details |
| PUT | `/api/stores/:id` | Update store |
| DELETE | `/api/stores/:id` | Delete store |
| GET | `/api/stores/:id/staff` | List store staff |
| POST | `/api/stores/:id/staff` | Assign staff to store |
| DELETE | `/api/stores/:id/staff/:userId` | Remove staff from store |
| GET | `/api/stores/:id/dashboard` | Store dashboard stats |
| GET | `/api/stores/:id/inventory` | Store-specific inventory |

### Database Models
- `Store` — Store record (name, code, address, phone, posProvider, active)
- `StoreStaff` — Staff-store assignment (userId, storeId, role)
- `StoreShipmentRequest` — In-store shipping orders (see Module 9)
- `StoreConfig` — Per-store configuration

### Dependencies
- `DatabaseModule`, `PosModule`, `InventoryModule`, `StoreShipmentModule`

### Third-Party Integrations
- **Lightspeed POS** — In-store operations

### Feature Flags
- `SHIP_FROM_STORE_ENABLED` — Enable ship-from-store feature

---

## 23. Events & Click-Collect

### Purpose
Manages in-store events (product launches, fan meetups) with RSVP/ticketing and the click-and-collect feature for online orders picked up in-store.

### Status
**Active** — Event management and click-and-collect implemented.

### Key Features

#### Events
- Event creation and management (product launches, fan meetups, themed events)
- RSVP and ticketing system
- Tier-based event access (e.g., Dragon Keeper+ only)
- Attendance tracking with automatic loyalty point awards (100 pts per event)
- Event audience targeting for invitations
- Event categories and tagging
- Event location mapping (store-specific)
- Event capacity management
- Waitlist support

#### Click & Collect
- Order online, pick up in-store
- Store availability checking
- Pickup time slot selection
- Ready-for-pickup notifications
- Pickup confirmation
- Bonus loyalty points for click-and-collect (if enabled)

### User Roles
| Role | Capabilities |
|------|-------------|
| CUSTOMER | RSVP, attend events, click-and-collect orders |
| ADMIN | Event creation, management, analytics |
| STORE_STAFF | Event check-in, pickup confirmation |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/events` | Event listing |
| `/events/[id]` | Event detail and RSVP |
| `/admin/events` | Event management |
| `/click-collect` | Click-and-collect order pickup |

### API Endpoints

#### Events
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/events` | List events |
| POST | `/api/events` | Create event (admin) |
| GET | `/api/events/:id` | Get event details |
| PUT | `/api/events/:id` | Update event |
| DELETE | `/api/events/:id` | Delete event |
| POST | `/api/events/:id/rsvp` | RSVP to event |
| DELETE | `/api/events/:id/rsvp` | Cancel RSVP |
| POST | `/api/events/:id/checkin` | Check in attendee |
| GET | `/api/events/:id/attendees` | List attendees |

#### Click & Collect
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/click-collect/orders` | Create click-and-collect order |
| GET | `/api/click-collect/orders` | List click-and-collect orders |
| GET | `/api/click-collect/orders/:id` | Get order details |
| PUT | `/api/click-collect/orders/:id/ready` | Mark as ready for pickup |
| PUT | `/api/click-collect/orders/:id/collected` | Confirm collection |
| GET | `/api/click-collect/stores/:storeId/availability` | Check store availability |
| GET | `/api/click-collect/stores/:storeId/slots` | Get available time slots |

### Database Models
- `Event` — Event definition (title, description, date, location, storeId, capacity, tierRequired)
- `EventRSVP` — RSVP records (userId, eventId, status)
- `EventAttendance` — Check-in records (userId, eventId, checkedInAt)
- `ClickCollectOrder` — Click-and-collect order (orderId, storeId, pickupSlot, status)

### Dependencies
- `DatabaseModule`, `LoyaltyModule`, `NotificationsModule`, `StoreAdminModule`, `OrdersModule`

### Third-Party Integrations
- None (platform-internal)

### Feature Flags
- `EVENTS_ENABLED` — Enable event management
- `CLICK_COLLECT_ENABLED` — Enable click-and-collect
- `CLICK_COLLECT_LOYALTY_BONUS` — Award bonus points for click-and-collect

---

## 24. Taxonomy (Fandoms, Characters, Universes, Departments)

### Purpose
Manages the product taxonomy system including fandoms, characters, universes, departments, categories, tags, attributes, and collections — providing the organizational structure for the fandom-centric marketplace.

### Status
**Active** — Full taxonomy management.

### Key Features
- **Fandoms** — Top-level product grouping (Harry Potter, Marvel, Star Wars, etc.)
- **Characters** — Named characters within fandoms
- **Universes** — Fictional universes spanning multiple fandoms
- **Departments** — Storefront sections (e.g., Wands, Clothing, Accessories)
- **Categories** — Hierarchical product categories (up to 3 levels)
- **Tags** — Product tags with categories (Theme, Occasion, Style, Character, Fandom, Custom)
- **Attributes** — Dynamic product attributes by category (TEXT, NUMBER, SELECT, BOOLEAN, DATE)
- **Collections** — Curated product lists (admin and user-created)
- **Category tree selector** — Hierarchical UI for category selection
- **Auto-loaded attributes** — Attributes load based on selected category
- **Fandom-based browsing** — Product discovery by fandom
- **Character profiles** — Character detail pages

### User Roles
| Role | Capabilities |
|------|-------------|
| ADMIN | Full taxonomy CRUD |
| CATALOG | Category and attribute management |
| CUSTOMER | Browse fandoms, characters, collections; create personal collections |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/fandoms` | Fandom listing |
| `/fandoms/[slug]` | Fandom detail with products |
| `/characters/[slug]` | Character detail page |
| `/collections` | Collection listing |
| `/collections/new` | Create personal collection |
| `/collections/[id]` | Collection detail |
| `/admin/categories` | Category management |
| `/admin/tags` | Tag management |
| `/admin/attributes` | Attribute management |

### API Endpoints

#### Taxonomy Core
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/taxonomy/categories` | List categories (tree) |
| POST | `/api/taxonomy/categories` | Create category |
| PUT | `/api/taxonomy/categories/:id` | Update category |
| DELETE | `/api/taxonomy/categories/:id` | Delete category |
| GET | `/api/taxonomy/categories/:id/attributes` | Get category attributes |
| GET | `/api/taxonomy/tags` | List tags |
| POST | `/api/taxonomy/tags` | Create tag |
| PUT | `/api/taxonomy/tags/:id` | Update tag |
| DELETE | `/api/taxonomy/tags/:id` | Delete tag |

#### Fandoms
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/fandoms` | List fandoms |
| GET | `/api/fandoms/:slug` | Get fandom details |
| POST | `/api/fandoms` | Create fandom (admin) |
| PUT | `/api/fandoms/:id` | Update fandom (admin) |
| DELETE | `/api/fandoms/:id` | Delete fandom (admin) |
| GET | `/api/fandoms/:id/products` | Get fandom products |

#### Characters
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/characters` | List characters |
| GET | `/api/characters/by-slug/:slug` | Get character by slug |
| GET | `/api/characters/:id` | Get character by ID |
| POST | `/api/characters` | Create character (admin) |
| PUT | `/api/characters/:id` | Update character (admin) |
| DELETE | `/api/characters/:id` | Delete character (admin) |

#### Universes
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/universes` | List universes |
| POST | `/api/universes` | Create universe (admin) |
| PUT | `/api/universes/:id` | Update universe |
| DELETE | `/api/universes/:id` | Delete universe |

#### Departments
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/departments` | List departments |
| POST | `/api/departments` | Create department (admin) |
| PUT | `/api/departments/:id` | Update department |
| DELETE | `/api/departments/:id` | Delete department |

#### Collections
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/collections` | List collections |
| POST | `/api/collections` | Create collection |
| GET | `/api/collections/:id` | Get collection details |
| PUT | `/api/collections/:id` | Update collection |
| DELETE | `/api/collections/:id` | Delete collection |
| POST | `/api/collections/:id/products` | Add product to collection |
| DELETE | `/api/collections/:id/products/:productId` | Remove product |

### Database Models
- `Category` — Hierarchical category (name, slug, parentId, level, icon)
- `Tag` — Product tags (name, slug, category)
- `Attribute` — Product attribute definition (name, type, categoryId, values[])
- `AttributeValue` — Predefined values for SELECT-type attributes
- `Fandom` — Fandom record (name, slug, description, logo, banner)
- `Character` — Character record (name, slug, fandomId, description, image)
- `Universe` — Universe record (name, slug, description)
- `Department` — Storefront section (name, slug, description, order)
- `Collection` — Curated product list (name, slug, userId, type: ADMIN/USER)
- `CollectionProduct` — Product-collection mapping

### Dependencies
- `DatabaseModule`, `CacheModule`, `ProductsModule`

### Third-Party Integrations
- None (platform-internal)

### Feature Flags
- None identified

---

## 25. Digital Products & Downloads

### Purpose
Manages digital product listings, delivery, and download management for non-physical products (e-books, digital art, printable templates, etc.).

### Status
**Active** — Digital product support with download management.

### Key Features
- Digital product listing and detail pages
- Digital file upload and storage
- Secure download links (time-limited, signed URLs)
- Download history tracking
- Download limit per purchase (counted once per download action; file redirect does not double-count)
- Automatic delivery on order completion
- Digital product types (e-book, artwork, template, audio, video)
- File format support (PDF, PNG, JPG, ZIP, MP3, MP4)
- Customer download library (`/downloads`)

### User Roles
| Role | Capabilities |
|------|-------------|
| CUSTOMER | Purchase and download digital products |
| ADMIN | Manage digital products, upload files |
| B2C_SELLER | List digital products |
| WHOLESALER | List digital products |

### Frontend Pages
| Route | Description |
|-------|-------------|
| `/downloads` | Customer download library |
| `/products/[id]` | Digital product detail (shared with physical) |

### API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/digital-products` | Create digital product |
| GET | `/api/digital-products` | List digital products |
| GET | `/api/digital-products/:id` | Get digital product details |
| PUT | `/api/digital-products/:id` | Update digital product |
| DELETE | `/api/digital-products/:id` | Delete digital product |
| POST | `/api/digital-products/:id/upload` | Upload digital file |
| GET | `/api/digital-products/:id/download` | Get download link |
| GET | `/api/digital-products/user/downloads` | Get user's download library |
| GET | `/api/digital-products/user/downloads/:id` | Download file |

### Database Models
- `DigitalProduct` — Digital product definition (productId, fileUrl, fileType, fileSize, maxDownloads)
- `DigitalDownload` — Download record (userId, digitalProductId, downloadedAt, ipAddress)
- `DigitalFile` — Uploaded file record (url, filename, size, format)

### Dependencies
- `DatabaseModule`, `StorageModule`, `OrdersModule`, `ProductsModule`

### Third-Party Integrations
- **AWS S3** — Secure file storage with signed URLs
- **Cloudinary** — Image-type digital product storage

### Feature Flags
- `DIGITAL_PRODUCTS_ENABLED` — Enable digital product features

---

## Additional Supporting Modules

### Uploads & Storage
- **Purpose:** File upload handling and storage provider abstraction
- **Providers:** Local, AWS S3, MinIO, Cloudinary (configurable via `STORAGE_PROVIDER`)
- **Endpoints:** `POST /api/uploads/single`, `POST /api/uploads/multiple`, `POST /api/uploads/cloudinary-signature`
- **Security:** Public file serving restricted to allowed path prefixes (`products/`, `banners/`, `avatars/`, `public/`, `reviews/`); other paths return 403
- **Models:** `Upload` — Upload record tracking

### Reviews & Ratings
- **Purpose:** Product review and rating system
- **Features:** Star ratings, text reviews, photo reviews, review moderation, loyalty points for reviews
- **Endpoints:** `GET/POST /api/reviews`, `PUT/DELETE /api/reviews/:id`, `PUT /api/reviews/:id/approve`
- **Models:** `ProductReview` — Review record (userId, productId, rating, comment, images[], approved)
- **Pages:** `/admin/reviews` — Review moderation

### Wishlist
- **Purpose:** Save products for later
- **Endpoints:** `GET/POST/DELETE /api/wishlist`
- **Models:** `WishlistItem` — Wishlist record (userId, productId)
- **Pages:** `/wishlist`

### AI Chat
- **Purpose:** AI-powered conversational assistant for product discovery
- **Integration:** Google Gemini API
- **Endpoints:** `POST /api/ai/chat`, `GET /api/ai/chat/history`, `PUT /api/ai/preferences`
- **Models:** `AIChat` — Conversation history, `AIPreference` — User AI preferences

### Currency & Geolocation
- **Purpose:** Multi-currency support and automatic country/currency detection
- **Endpoints:** `GET /api/currency/rates`, `GET /api/geolocation/detect`, `PUT /api/currency/preference`
- **Models:** `CurrencyRate` — Exchange rates

### Domains & Themes
- **Purpose:** Custom domain management for seller storefronts and theme customization
- **Endpoints:** `GET/POST/PUT/DELETE /api/domains`, `GET/POST/PUT/DELETE /api/themes`
- **Security:** Seller-scoped domain endpoints enforce ownership verification (non-admin users can only manage domains for their own store)
- **Models:** `Domain` — Custom domain records, `Theme` — Theme configuration

### Customer Groups
- **Purpose:** Customer segmentation for pricing and promotions
- **Endpoints:** `GET/POST/PUT/DELETE /api/customer-groups`
- **Models:** `CustomerGroup` — Group definition, `CustomerGroupMember` — Group membership

### Tenants
- **Purpose:** Multi-tenant architecture for platform isolation
- **Endpoints:** `GET/POST/PUT /api/tenants`
- **Models:** `Tenant`, `TenantUser`, `Config`

### Tax
- **Purpose:** Tax calculation and zone management
- **Endpoints:** `POST /api/tax/calculate`, `GET/POST/PUT/DELETE /api/tax/zones`
- **Models:** `TaxZone`, `TaxRate`
- **Integration:** Stripe Tax, Avalara (via integrations framework)
- **Pages:** `/admin/tax-zones`

---

## Appendix A: Feature Flag Reference

All feature flags are managed via `FeatureFlagsService` (`services/api/src/config/feature-flags.service.ts`).

**Resolution order:** Environment variable (`FF_<FLAG>=true|1`) → DB `platform_settings` (category: `feature_flag`) → Code default. Cached for 30 seconds.

**Admin API:** `GET /api/admin/feature-flags` (list all), `PUT /api/admin/feature-flags/:flag` (toggle).

| Flag | Env Override | Module | Purpose | Default |
|------|-------------|--------|---------|---------|
| `FOUNDING_MEMBERS` | `FF_FOUNDING_MEMBERS` | Loyalty | Founding member registration flow | `true` |
| `EMAIL_TEMPLATE_OVERRIDES` | `FF_EMAIL_TEMPLATE_OVERRIDES` | Notifications | Custom email template overrides | `true` |
| `ADMIN_EMAIL_COMPOSE` | `FF_ADMIN_EMAIL_COMPOSE` | Notifications | Admin email compose UI | `true` |
| `LOYALTY_PROGRAMME` | `FF_LOYALTY_PROGRAMME` | Loyalty | Master toggle for The Enchanted Circle loyalty programme | `true` |
| `AMBASSADOR_PROGRAMME` | `FF_AMBASSADOR_PROGRAMME` | Loyalty | Ambassador programme (Dragon Keeper+ tier) | `true` |
| `BRAND_PARTNERSHIPS` | `FF_BRAND_PARTNERSHIPS` | Loyalty | Brand partnership campaigns | `true` |
| `CLICK_COLLECT` | `FF_CLICK_COLLECT` | Store Operations | Click-and-collect functionality | `true` |
| `DIGITAL_PRODUCTS` | `FF_DIGITAL_PRODUCTS` | Digital Products | Digital product listings and downloads | `true` |
| `INFLUENCER_STOREFRONTS` | `FF_INFLUENCER_STOREFRONTS` | Influencer | Influencer storefront curation | `true` |
| `GUEST_CHECKOUT` | `FF_GUEST_CHECKOUT` | Commerce | Guest checkout without account registration | `true` |
| `AI_RECOMMENDATIONS` | `FF_AI_RECOMMENDATIONS` | AI | AI-powered product recommendations | `false` |
| `POS_INTEGRATION` | `FF_POS_INTEGRATION` | POS | POS integration (also requires `POS_ENABLED` env var) | `false` |
| `MULTI_CURRENCY` | `FF_MULTI_CURRENCY` | Currency | Multi-currency FX conversion | `false` |
| `ACCOUNTING_XERO` | `FF_ACCOUNTING_XERO` | Finance | HOS → Xero journal posting (also requires `ACCOUNTING_ENABLED`) | `false` |
| `SHIPPING_ONLINE_PAYMENT` | `FF_SHIPPING_ONLINE_PAYMENT` | Store Operations | Stripe payment on customer phone for in-store shipping | `false` |

**Additional Environment-Based Gates (not feature flags but control behavior):**

| Variable | Module | Purpose |
|----------|--------|---------|
| `REGISTRATION_MODE` | Auth | Set to `invite_only` to restrict registration to invited users |
| `FANDOM_CHALLENGE_REQUIRED` | Auth | Require fandom trivia challenge during customer registration (default: true; both token and answer are mandatory when enabled) |
| `ACCESS_CONTROL_MODE` | Access Control | `legacy` / `shadow` / `enforce` for permission engine mode |
| `POS_ENABLED` | POS | Required alongside `POS_INTEGRATION` flag for POS sync |
| `ACCOUNTING_ENABLED` | Finance | Required alongside `ACCOUNTING_XERO` flag |

---

## Appendix B: User Role Reference

| Role | Enum Value | Description | Primary Dashboard |
|------|-----------|-------------|-------------------|
| Customer | `CUSTOMER` | End-user / buyer | `/customer/dashboard` |
| Wholesaler | `WHOLESALER` | B2B supply-chain seller — product submission pipeline and fulfilment centre operations | `/wholesaler/dashboard` |
| B2C Seller | `B2C_SELLER` | Individual / business seller | `/seller/dashboard` |
| Admin | `ADMIN` | Platform administrator (full access) | `/admin/dashboard` |
| Influencer | `INFLUENCER` | Affiliate / content creator | `/influencer/dashboard` |
| Procurement | `PROCUREMENT` | Procurement staff | `/procurement/dashboard` |
| Fulfillment | `FULFILLMENT` | Fulfillment / warehouse staff | `/fulfillment/dashboard` |
| Catalog | `CATALOG` | Catalog management staff | `/catalog/dashboard` |
| Marketing | `MARKETING` | Marketing team | `/marketing/dashboard` |
| Finance | `FINANCE` | Finance / accounting team | `/finance/dashboard` |
| CMS Editor | `CMS_EDITOR` | Content editor | `/cms/dashboard` |
| Sales | `SALES` | Sales team (portal TBD) | — |
| Store Staff | `STORE_STAFF` | Physical store staff | `/store/shipping` |

---

*End of Document*
