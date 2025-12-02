-- Phase 6: Fandom Experience Features - Database Schema
-- Add new tables for character selection, AI chat, gamification, and social sharing

-- Fandoms table
CREATE TABLE IF NOT EXISTS fandoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  image VARCHAR(500),
  banner VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fandoms_slug ON fandoms(slug);
CREATE INDEX idx_fandoms_active ON fandoms(is_active) WHERE is_active = true;

-- Characters table (for AI personas)
CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fandom_id UUID NOT NULL REFERENCES fandoms(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  personality TEXT, -- JSON personality traits
  system_prompt TEXT, -- AI system prompt
  avatar VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_characters_fandom ON characters(fandom_id);
CREATE INDEX idx_characters_active ON characters(is_active) WHERE is_active = true;

-- AI Chats table
CREATE TABLE IF NOT EXISTS ai_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  context JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ai_chats_user ON ai_chats(user_id);
CREATE INDEX idx_ai_chats_character ON ai_chats(character_id);
CREATE INDEX idx_ai_chats_user_character ON ai_chats(user_id, character_id);

-- Badges table
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(500),
  category VARCHAR(50) NOT NULL,
  rarity VARCHAR(50) DEFAULT 'COMMON',
  points INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- User Badges table
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);
CREATE INDEX idx_user_badges_badge ON user_badges(badge_id);

-- Quests table
CREATE TABLE IF NOT EXISTS quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,
  fandom_id UUID REFERENCES fandoms(id),
  points INTEGER DEFAULT 0,
  badge_id UUID REFERENCES badges(id),
  requirements JSONB,
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMP,
  ends_at TIMESTAMP
);

-- User Quests table
CREATE TABLE IF NOT EXISTS user_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  progress JSONB,
  status VARCHAR(50) DEFAULT 'IN_PROGRESS',
  completed_at TIMESTAMP,
  UNIQUE(user_id, quest_id)
);

CREATE INDEX idx_user_quests_user ON user_quests(user_id);
CREATE INDEX idx_user_quests_quest ON user_quests(quest_id);

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_collections_user ON collections(user_id);
CREATE INDEX idx_collections_public ON collections(is_public) WHERE is_public = true;

-- Shared Items table (for social sharing)
CREATE TABLE IF NOT EXISTS shared_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  item_id UUID NOT NULL,
  content JSONB NOT NULL,
  platform VARCHAR(100),
  views INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_shared_items_user ON shared_items(user_id);
CREATE INDEX idx_shared_items_type ON shared_items(type);
CREATE INDEX idx_shared_items_created ON shared_items(created_at DESC);

-- Update Users table to add fandom experience fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS character_avatar UUID REFERENCES characters(id),
ADD COLUMN IF NOT EXISTS favorite_fandoms TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS gamification_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS ai_preferences JSONB;

CREATE INDEX idx_users_character_avatar ON users(character_avatar) WHERE character_avatar IS NOT NULL;
CREATE INDEX idx_users_level ON users(level);

