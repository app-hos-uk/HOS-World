# House of Spells Marketplace - Business Flow & Role Review

## Executive Summary

House of Spells (HOS) is a **multi-vendor fandom merchandise marketplace** with a unique **wholesaler-to-consumer (W2C)** model. The platform connects wholesalers (product suppliers) with B2C sellers and end customers, facilitated by HOS operational teams. The system includes **gamification features** to enhance customer engagement and GDPR-compliant data handling.

---

## System Roles Overview

| Role | Type | Primary Purpose |
|------|------|-----------------|
| CUSTOMER | End User | Browse, purchase products, participate in gamification |
| WHOLESALER | Seller | Bulk product submission, wholesale pricing |
| B2C_SELLER | Seller | Consumer-facing product sales |
| ADMIN | Platform Staff | Full system administration |
| PROCUREMENT | Platform Staff | Review and approve product submissions |
| FULFILLMENT | Platform Staff | Manage shipments, verify inventory |
| CATALOG | Platform Staff | Create product listings and metadata |
| MARKETING | Platform Staff | Generate marketing materials |
| FINANCE | Platform Staff | Pricing approval, financial operations |
| CMS_EDITOR | Platform Staff | Content management (pages, banners, blog) |

---

## Detailed Role Analysis

### 1. CUSTOMER Role

**Description:** End consumers who browse and purchase products from the marketplace.

#### Features & Capabilities:
- **Browse & Search Products**
  - View products by fandom (Harry Potter, Marvel, Star Wars, etc.)
  - Filter by category, price, seller
  - View product details, images, and variations

- **Shopping Cart & Checkout**
  - Add products to cart with variation options
  - Manage cart items (quantity updates, removal)
  - Checkout with multiple payment options (Stripe, Klarna)

- **Order Management**
  - View order history and status tracking
  - Track shipments with tracking numbers
  - Request returns/refunds

- **Profile Management**
  - Update personal information
  - Manage addresses (shipping/billing)
  - Set currency preference (GBP, USD, EUR, AED)
  - Configure communication preferences (Email, SMS, WhatsApp, Phone)

- **Gamification Features**
  - **Level System:** Points-based progression (Level 1+)
  - **Badges:** Earn badges for achievements (COMMON, RARE, EPIC)
  - **Quests:** Complete quests for rewards
  - **Collections:** Create and manage product collections
  - **Character Avatar:** Select favorite fandom character
  - **Favorite Fandoms:** Personalized fandom preferences

- **GDPR Compliance**
  - View/update consent preferences (marketing, analytics)
  - Export personal data (GDPR Article 15)
  - Delete account with data anonymization (GDPR Article 17)
  - View consent history

- **Wishlist**
  - Save products for later purchase
  - Share wishlist items

- **Reviews**
  - Write product reviews (1-5 stars)
  - Mark reviews as helpful

---

### 2. WHOLESALER Role

**Description:** Bulk product suppliers who submit products for approval and sale on the platform.

#### Features & Capabilities:

**Dashboard (`/wholesaler/dashboard`):**
- Total sales overview
- Total orders count
- Product count and stats
- Submission status tracking
- Average order value

**Key Functions:**

1. **Product Submission** (`/seller/submit-product`)
   - Submit new products with:
     - Name, description, SKU, barcode, EAN
     - Price (trade price, RRP)
     - Stock quantity
     - Fandom/category assignment
     - Product images (multiple)
     - Variations (size, color, etc.)
   - Submit for procurement review

2. **Submission Tracking** (`/wholesaler/submissions`)
   - Monitor submission status through workflow:
     - SUBMITTED → UNDER_REVIEW → PROCUREMENT_APPROVED/REJECTED
     - → SHIPPED_TO_FC → FC_ACCEPTED/REJECTED
     - → CATALOG_COMPLETED → MARKETING_COMPLETED
     - → FINANCE_APPROVED → PUBLISHED

3. **Product Management** (`/wholesaler/products`)
   - View published products
   - Track inventory levels

4. **Order Management** (`/wholesaler/orders`)
   - View bulk orders
   - Track order fulfillment

**Business Logic:**
- Wholesalers submit products which go through a multi-stage approval workflow
- Products must be physically shipped to HOS Fulfillment Centers (FC)
- HOS manages the catalog listing, marketing, and pricing
- Settlement payments are processed after sales

---

### 3. B2C_SELLER Role

**Description:** Consumer-facing sellers who sell products directly to end customers.

#### Features & Capabilities:

**Dashboard (`/seller/dashboard`):**
- Sales metrics and analytics
- Order statistics
- Product performance
- Submission status

**Key Functions:**

1. **Product Submission**
   - Same workflow as wholesaler
   - Submit products for review and approval

2. **Store Management**
   - Custom store branding (logo, theme)
   - Store description and details
   - Custom subdomain option (e.g., `mystore.houseofspells.com`)
   - Custom domain support (premium feature)

3. **Theme Customization** (`/seller/themes`)
   - Select from HOS themes
   - Custom logo and favicon
   - Custom color schemes

4. **Order Fulfillment** (`/seller/orders`)
   - View and manage customer orders
   - Update order status
   - Add tracking information

5. **Onboarding** (`/seller/onboarding`)
   - Complete seller profile
   - Set store name and country
   - Configure logistics option:
     - HOS_LOGISTICS: Use HOS fulfillment
     - SELLER_OWN: Handle own shipping
     - HOS_PARTNER: Use HOS logistics partners

**Business Logic:**
- B2C sellers can have their own storefront within the marketplace
- Products go through the same approval workflow
- Sellers can choose logistics options
- Platform takes commission from sales

---

### 4. ADMIN Role

**Description:** Full platform administrators with complete system access.

#### Features & Capabilities:

**Dashboard (`/admin/dashboard`):**
- Platform-wide statistics
- Total products, orders, submissions
- Total sellers and customers
- Recent activity overview

**Key Admin Functions:**

1. **User Management** (`/admin/users`)
   - Create/edit/delete users
   - Assign roles and permissions
   - Reset passwords
   - View user activity

2. **Product Management** (`/admin/products`)
   - Create platform-owned products
   - Edit any product
   - Manage product status

3. **Seller Management** (`/admin/sellers`)
   - View all sellers
   - Approve/suspend sellers
   - Invite new sellers via email
   - Manage seller invitations

4. **Taxonomy Management**
   - **Categories** (`/admin/categories`): 3-level hierarchy
   - **Attributes** (`/admin/attributes`): Product attributes (size, color, etc.)
   - **Tags** (`/admin/tags`): Theme, occasion, style, character, fandom tags

5. **Permission Management** (`/admin/permissions`)
   - Create custom permission roles
   - Assign granular permissions to roles:
     - Products: create, edit, delete, publish, view
     - Orders: view, manage, cancel, refund
     - Users: view, create, edit, delete, roles
     - Business Ops: submissions.review, shipments.verify, etc.
     - System: settings, themes, permissions, analytics

6. **Finance** (`/admin/finance`)
   - View platform revenue
   - Manage transactions
   - Process refunds
   - Seller payouts

7. **Reports** (`/admin/reports/*`)
   - Platform metrics
   - Sales reports
   - User analytics
   - Product performance

8. **System Settings** (`/admin/settings`)
   - Platform configuration
   - Payment settings
   - Email/notification settings

9. **Domain Management** (`/admin/domains`)
   - Assign subdomains to sellers
   - Configure custom domains

10. **Theme Management** (`/admin/themes`)
    - Create/edit platform themes
    - Manage seller theme options

11. **Support** (`/admin/support`)
    - View/manage support tickets
    - Assign tickets to agents

12. **Role Impersonation**
    - Switch between roles for testing
    - View platform as different user types

---

### 5. PROCUREMENT Role

**Description:** Reviews and approves product submissions from sellers.

#### Features & Capabilities:

**Dashboard (`/procurement/dashboard`):**
- Pending submissions count
- Duplicate alerts
- Under review count
- Approved today count

**Key Functions:**

1. **Submission Review** (`/procurement/submissions`)
   - Review new product submissions
   - Verify product information
   - Check for duplicates (similarity detection)
   - Select procurement quantity
   - Add notes

2. **Actions:**
   - APPROVE → Submission moves to shipment stage
   - REJECT → Return to seller with reason
   - Request more information

**Business Logic:**
- First stage of the product approval workflow
- Procurement evaluates product market fit
- Checks for duplicate/similar products in catalog
- Determines quantity to order from wholesaler

---

### 6. FULFILLMENT Role

**Description:** Manages incoming shipments and inventory verification.

#### Features & Capabilities:

**Dashboard (`/fulfillment/dashboard`):**
- Incoming shipments count
- Pending verification
- Verified today
- Rejected count

**Key Functions:**

1. **Shipment Management** (`/fulfillment/shipments`)
   - View incoming shipments
   - Track shipment status:
     - PENDING → IN_TRANSIT → RECEIVED → VERIFIED/REJECTED
   - Add tracking numbers
   - Update shipment status

2. **Verification Process:**
   - Verify received goods match submission
   - Check quality and quantity
   - Add verification notes
   - Accept or reject shipment

3. **Fulfillment Centers:**
   - Manage multiple FC locations
   - Track inventory per center

**Business Logic:**
- Physical goods are shipped to HOS fulfillment centers
- Fulfillment team verifies shipments match approved submissions
- Verified products move to catalog creation stage
- Rejected products are returned or reported as discrepancies

---

### 7. CATALOG Role

**Description:** Creates marketplace listings from approved products.

#### Features & Capabilities:

**Dashboard (`/catalog/dashboard`):**
- Pending catalog entries
- Completed entries
- Statistics

**Key Functions:**

1. **Catalog Entry Creation** (`/catalog/entries`)
   - Create product listings from verified shipments
   - Write product titles and descriptions
   - Add SEO keywords
   - Manage product images
   - Define product specifications

2. **Content Quality:**
   - Standardize product information
   - Ensure consistent formatting
   - Optimize for search

**Business Logic:**
- Catalog team transforms raw product data into polished listings
- Ensures consistency across the marketplace
- Adds marketing-friendly descriptions
- Completes catalog → moves to marketing stage

---

### 8. MARKETING Role

**Description:** Creates marketing materials for products.

#### Features & Capabilities:

**Dashboard (`/marketing/dashboard`):**
- Pending materials count
- Completed materials
- Statistics

**Key Functions:**

1. **Material Creation** (`/marketing/materials`)
   - Create promotional content:
     - BANNER: Website banners
     - CREATIVE: Social media graphics
     - PRODUCT_IMAGE: Enhanced product photos
     - CAMPAIGN_ASSET: Campaign materials

2. **Asset Management:**
   - Upload marketing assets
   - Link materials to submissions
   - Track material usage

**Business Logic:**
- Marketing creates assets for new products
- Materials support product launch and promotion
- Completes marketing → moves to finance stage

---

### 9. FINANCE Role

**Description:** Manages pricing approval and financial operations.

#### Features & Capabilities:

**Dashboard (`/finance/dashboard`):**
- Pending pricing approvals
- Total revenue
- Platform fees
- Payouts pending

**Key Functions:**

1. **Pricing Approval** (`/finance/pricing`)
   - Review proposed pricing
   - Set HOS margin percentage
   - Define visibility level:
     - STANDARD: Normal listing
     - FEATURED: Highlighted placement
     - PREMIUM: Top placement
     - HIDDEN: Not shown publicly
   - Approve or reject pricing

2. **Financial Reports:**
   - Revenue reports
   - Transaction history
   - Fee calculations

3. **Payouts:**
   - Schedule seller payouts
   - Process payments

4. **Transactions:**
   - View all transactions
   - Track payment status
   - Process refunds

**Business Logic:**
- Finance is the final approval before product goes live
- Sets the final consumer price with margin
- Manages platform economics
- Approves → product is PUBLISHED and live on marketplace

---

### 10. CMS_EDITOR Role

**Description:** Manages website content - pages, banners, and blog posts.

#### Features & Capabilities:

**Dashboard (`/cms/dashboard`):**
- Total pages
- Total banners (hero, promotional, sidebar)
- Blog posts (published/draft)

**Key Functions:**

1. **Page Management** (`/cms/pages`)
   - Create/edit static pages
   - SEO metadata (title, description, keywords)
   - Rich content editing

2. **Banner Management** (`/cms/banners`)
   - Hero banners for homepage
   - Promotional banners
   - Sidebar advertisements

3. **Blog** (`/cms/blog`)
   - Write blog posts
   - Manage drafts
   - Publish/unpublish articles

4. **Media Library** (`/cms/media`)
   - Upload images
   - Manage media assets

5. **Settings** (`/cms/settings`)
   - CMS configuration

---

## Core Business Workflows

### Product Submission Workflow

```
SELLER/WHOLESALER              PLATFORM TEAMS
      │                              │
      ▼                              │
[Submit Product]                     │
      │                              │
      ▼                              ▼
  SUBMITTED ───────────────► PROCUREMENT REVIEW
      │                              │
      │              ┌───────────────┴───────────────┐
      │              ▼                               ▼
      │       PROCUREMENT_APPROVED           PROCUREMENT_REJECTED
      │              │                               │
      │              ▼                               ▼
      │       [Ship to FC]                    [End/Revise]
      │              │
      │              ▼
      │       FULFILLMENT VERIFICATION
      │              │
      │       ┌──────┴──────┐
      │       ▼             ▼
      │   FC_ACCEPTED   FC_REJECTED
      │       │             │
      │       ▼             ▼
      │   CATALOG CREATION  [End]
      │       │
      │       ▼
      │   CATALOG_COMPLETED
      │       │
      │       ▼
      │   MARKETING MATERIALS
      │       │
      │       ▼
      │   MARKETING_COMPLETED
      │       │
      │       ▼
      │   FINANCE PRICING
      │       │
      │   ┌───┴───┐
      │   ▼       ▼
      │ FINANCE  REJECTED
      │ APPROVED    │
      │   │         ▼
      │   ▼      [End]
      │ PUBLISHED
      │   │
      │   ▼
      │ [LIVE ON MARKETPLACE]
```

### Customer Purchase Flow

```
[Browse Products]
      │
      ▼
[Add to Cart]
      │
      ▼
[Checkout]
      │
      ├── Select Shipping Address
      ├── Select Payment Method
      │
      ▼
[Payment Processing]
      │
      ├── Stripe / Klarna
      │
      ▼
[Order Created]
      │
      ▼
ORDER STATUS: PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
      │
      ▼
[Optional: Request Return]
      │
      ▼
RETURN STATUS: PENDING → APPROVED/REJECTED → PROCESSING → COMPLETED
```

### Settlement & Payout Flow

```
[Orders Fulfilled]
      │
      ▼
[Settlement Period Ends]
      │
      ▼
[Calculate Settlement]
      │
      ├── Total Sales
      ├── Platform Fee (HOS margin)
      ├── Net Amount to Seller
      │
      ▼
SETTLEMENT STATUS: PENDING → PROCESSING → PAID
      │
      ▼
[Payout to Seller]
```

---

## Key Platform Features

### 1. Multi-Currency Support
- Base currency: GBP
- Supported: USD, EUR, AED
- Real-time exchange rates
- User preference saved to profile

### 2. Multi-Region Support
- Geolocation detection
- Country-specific compliance
- Tax rate calculation per country

### 3. GDPR Compliance
- Consent management (marketing, analytics)
- Data export (Article 15)
- Account deletion with anonymization (Article 17)
- Consent history logging

### 4. Communication Options
- Email notifications
- SMS alerts
- WhatsApp integration
- Phone support

### 5. Gamification Engine
- Points-based leveling system
- Achievement badges (Common, Rare, Epic)
- Quests with rewards
- Collections feature
- Character avatars (fandom-based)

### 6. Fandom-First Experience
- Character-based navigation
- Fandom collections (Harry Potter, Marvel, etc.)
- Personalized recommendations
- AI chat with characters

### 7. Seller Theming
- Custom store themes
- Logo and favicon customization
- Color scheme options
- Subdomain/custom domain support

### 8. Duplicate Detection
- Similarity scoring for products
- Prevents catalog redundancy
- Alerts for procurement team

---

## Database Models Summary

### Core Models
- User, Customer, Seller
- Product, ProductSubmission
- Order, OrderItem, Cart, CartItem
- Payment, Transaction, Settlement

### Workflow Models
- Shipment, FulfillmentCenter
- CatalogEntry, MarketingMaterial
- ProductPricing, DuplicateProduct

### Gamification Models
- Fandom, Character, AIChat
- Badge, UserBadge
- Quest, UserQuest
- Collection, SharedItem

### Support Models
- SupportTicket, TicketMessage
- KnowledgeBaseArticle
- WhatsAppConversation, WhatsAppMessage

### Taxonomy Models
- Category (3-level hierarchy)
- Attribute, AttributeValue
- Tag, ProductTag

---

## Permission System

### Built-in Roles
Each role has default permissions. Custom roles can be created with any combination.

### Permission Categories
1. **Products**: create, edit, delete, publish, view
2. **Orders**: view, manage, cancel, refund
3. **Users**: view, create, edit, delete, roles
4. **Business Operations**: 
   - submissions.review/approve/reject
   - shipments.verify
   - catalog.create
   - marketing.create
   - pricing.approve
5. **System**: settings, themes, permissions, analytics
6. **Sellers**: view, approve, suspend

---

## Technology Stack

### Frontend
- Next.js 14 (React)
- Tailwind CSS
- TypeScript

### Backend
- NestJS (Node.js)
- Prisma ORM
- PostgreSQL

### Infrastructure
- Railway (deployment)
- Redis (caching, queues)
- Elasticsearch (search - optional)
- S3/MinIO (file storage)

### Payments
- Stripe
- Klarna

---

## Summary

The House of Spells Marketplace is a comprehensive e-commerce platform with:

1. **Multi-role system** supporting customers, various seller types, and specialized operational teams
2. **Complex workflow engine** for product approval from submission to publication
3. **Gamification layer** to enhance customer engagement
4. **GDPR-compliant** data handling
5. **Multi-currency/region** support
6. **Extensible permission system** for fine-grained access control

The platform effectively bridges wholesalers and consumers through a managed marketplace model where HOS controls quality, pricing, and fulfillment.
