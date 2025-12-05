-- SQL script to create team role users
-- Password for all: Test123!
-- Password hash: $2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

-- Create ADMIN user
INSERT INTO users (id, email, password, "firstName", "lastName", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@hos.test',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Admin',
  'User',
  'ADMIN',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET 
  role = 'ADMIN',
  password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  "updatedAt" = NOW();

-- Create PROCUREMENT user
INSERT INTO users (id, email, password, "firstName", "lastName", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'procurement@hos.test',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Procurement',
  'Manager',
  'PROCUREMENT',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET 
  role = 'PROCUREMENT',
  password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  "updatedAt" = NOW();

-- Create FULFILLMENT user
INSERT INTO users (id, email, password, "firstName", "lastName", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'fulfillment@hos.test',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Fulfillment',
  'Staff',
  'FULFILLMENT',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET 
  role = 'FULFILLMENT',
  password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  "updatedAt" = NOW();

-- Create CATALOG user
INSERT INTO users (id, email, password, "firstName", "lastName", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'catalog@hos.test',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Catalog',
  'Editor',
  'CATALOG',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET 
  role = 'CATALOG',
  password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  "updatedAt" = NOW();

-- Create MARKETING user
INSERT INTO users (id, email, password, "firstName", "lastName", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'marketing@hos.test',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Marketing',
  'Manager',
  'MARKETING',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET 
  role = 'MARKETING',
  password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  "updatedAt" = NOW();

-- Create FINANCE user
INSERT INTO users (id, email, password, "firstName", "lastName", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'finance@hos.test',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Finance',
  'Manager',
  'FINANCE',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET 
  role = 'FINANCE',
  password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  "updatedAt" = NOW();

-- Create CMS_EDITOR user
INSERT INTO users (id, email, password, "firstName", "lastName", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'cms@hos.test',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'CMS',
  'Editor',
  'CMS_EDITOR',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET 
  role = 'CMS_EDITOR',
  password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  "updatedAt" = NOW();

-- Verify users created
SELECT email, role, "firstName", "lastName", "createdAt"
FROM users
WHERE email LIKE '%@hos.test'
ORDER BY role;

