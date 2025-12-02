-- Phase 5: Advanced Features - Database Schema Updates

-- OAuth Accounts Table
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'google', 'facebook', 'apple'
  provider_id VARCHAR(255) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider, provider_id),
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX idx_oauth_accounts_provider ON oauth_accounts(provider, provider_id);

-- Newsletter Subscriptions Table
CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'subscribed', -- 'subscribed', 'unsubscribed', 'bounced'
  subscribed_at TIMESTAMP DEFAULT NOW(),
  unsubscribed_at TIMESTAMP,
  source VARCHAR(100), -- 'website', 'checkout', 'api'
  tags JSONB, -- Additional tags for segmentation
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_newsletter_email ON newsletter_subscriptions(email);
CREATE INDEX idx_newsletter_status ON newsletter_subscriptions(status);
CREATE INDEX idx_newsletter_user_id ON newsletter_subscriptions(user_id);

-- Gift Cards Table
CREATE TABLE IF NOT EXISTS gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL, -- 'digital', 'physical'
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  balance DECIMAL(10, 2) NOT NULL, -- Remaining balance
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'redeemed', 'expired', 'cancelled'
  issued_to_email VARCHAR(255),
  issued_to_name VARCHAR(255),
  purchased_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  redeemed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMP,
  expires_at TIMESTAMP,
  message TEXT,
  issued_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_gift_cards_code ON gift_cards(code);
CREATE INDEX idx_gift_cards_status ON gift_cards(status);
CREATE INDEX idx_gift_cards_purchased_by ON gift_cards(purchased_by_user_id);
CREATE INDEX idx_gift_cards_redeemed_by ON gift_cards(redeemed_by_user_id);
CREATE INDEX idx_gift_cards_email ON gift_cards(issued_to_email);

-- Gift Card Transactions Table (track usage)
CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id UUID NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  balance_before DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'redeemed', 'refunded', 'issued'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_gift_card_transactions_card_id ON gift_card_transactions(gift_card_id);
CREATE INDEX idx_gift_card_transactions_order_id ON gift_card_transactions(order_id);

-- Update Users table to make password optional (for OAuth users)
-- Note: This is already nullable in the schema, but ensure it's set up correctly
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

