# Phase 5: Advanced Features - Implementation Plan

## Overview

Phase 5 focuses on advanced features to enhance user experience and business capabilities.

## Implementation Order

### Priority 1: Social Login Integration
1. ✅ OAuth Strategies (Google, Facebook, Apple)
2. 🔄 Update Prisma schema with OAuth accounts
3. 🔄 OAuth controllers and routes
4. 🔄 Link/unlink OAuth accounts
5. 🔄 Update AuthService with OAuth methods

### Priority 2: Newsletter System
1. Newsletter subscription management
2. Email list management
3. Unsubscribe functionality
4. Newsletter sending service
5. Integration with email service

### Priority 3: Gift Cards
1. Gift card creation (digital/physical)
2. Gift card redemption
3. Balance tracking
4. Gift card transactions
5. Expiration management

### Priority 4: Returns Management Enhancement
1. Complete returns workflow (already started in Phase 2)
2. Return authorization
3. Return shipping labels
4. Refund processing
5. Return analytics

### Priority 5: Klarna Integration
1. Klarna payment method
2. Payment session creation
3. Order confirmation
4. Refund handling
5. Webhook handling

## Database Schema Updates

### New Tables:
- `oauth_accounts` - OAuth provider accounts
- `newsletter_subscriptions` - Newsletter email list
- `gift_cards` - Gift card management
- `gift_card_transactions` - Gift card usage tracking

### Schema Updates:
- Users: Make password optional (for OAuth users)

## API Endpoints to Create

### Social Login (6 endpoints)
- GET /api/auth/google
- GET /api/auth/google/callback
- GET /api/auth/facebook
- GET /api/auth/facebook/callback
- GET /api/auth/apple
- GET /api/auth/apple/callback
- GET /api/auth/oauth/accounts (list linked accounts)
- DELETE /api/auth/oauth/accounts/:provider (unlink)

### Newsletter (4 endpoints)
- POST /api/newsletter/subscribe
- POST /api/newsletter/unsubscribe
- GET /api/newsletter/subscription-status
- GET /api/newsletter/subscriptions (admin)

### Gift Cards (8 endpoints)
- POST /api/gift-cards (create/purchase)
- GET /api/gift-cards/:code (validate)
- POST /api/gift-cards/:code/redeem
- GET /api/gift-cards/my-gift-cards
- GET /api/gift-cards/:id/transactions
- POST /api/gift-cards/:id/refund
- GET /api/gift-cards (admin - list all)

### Klarna (5 endpoints)
- POST /api/payments/klarna/session
- POST /api/payments/klarna/confirm
- POST /api/payments/klarna/capture
- POST /api/payments/klarna/refund
- POST /api/payments/klarna/webhook

## Dependencies Needed

### OAuth:
- passport-google-oauth20
- passport-facebook
- passport-apple (or @nielse63/passport-apple)

### Newsletter:
- Already have nodemailer
- May need SendGrid/Mailchimp integration

### Gift Cards:
- UUID generation
- Code generation utilities

### Klarna:
- @klarna/checkout
- @klarna/payments-node-sdk

## Implementation Status

- ✅ OAuth Strategies Created
- ✅ OAuth Service Methods Created
- 🔄 Schema Updates (in progress)
- 🔄 Controllers (in progress)
- ⏳ Remaining features

