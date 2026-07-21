-- SQL script to create team role users
-- IMPORTANT: Generate a fresh bcrypt hash from your TEST_SEED_PASSWORD before running:
--   node -e "require('bcrypt').hash(process.env.TEST_SEED_PASSWORD, 12).then(h => console.log(h))"
-- Replace <BCRYPT_HASH> below with the generated hash.

-- Create ADMIN user
INSERT INTO users (id, email, password, "firstName", "lastName", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@hos.test',
  '<BCRYPT_HASH>',
  'Admin',
  'User',
  'ADMIN',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET 
  role = 'ADMIN',
  password = '<BCRYPT_HASH>',
  "updatedAt" = NOW();

-- Create PROCUREMENT user
INSERT INTO users (id, email, password, "firstName", "lastName", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'procurement@hos.test',
  '<BCRYPT_HASH>',
  'Procurement',
  'Manager',
  'PROCUREMENT',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET 
  role = 'PROCUREMENT',
  password = '<BCRYPT_HASH>',
  "updatedAt" = NOW();

-- Create FULFILLMENT user
INSERT INTO users (id, email, password, "firstName", "lastName", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'fulfillment@hos.test',
  '<BCRYPT_HASH>',
  'Fulfillment',
  'Staff',
  'FULFILLMENT',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET 
  role = 'FULFILLMENT',
  password = '<BCRYPT_HASH>',
  "updatedAt" = NOW();

-- Create CATALOG user
INSERT INTO users (id, email, password, "firstName", "lastName", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'catalog@hos.test',
  '<BCRYPT_HASH>',
  'Catalog',
  'Editor',
  'CATALOG',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET 
  role = 'CATALOG',
  password = '<BCRYPT_HASH>',
  "updatedAt" = NOW();

-- Create MARKETING user
INSERT INTO users (id, email, password, "firstName", "lastName", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'marketing@hos.test',
  '<BCRYPT_HASH>',
  'Marketing',
  'Manager',
  'MARKETING',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET 
  role = 'MARKETING',
  password = '<BCRYPT_HASH>',
  "updatedAt" = NOW();

-- Create FINANCE user
INSERT INTO users (id, email, password, "firstName", "lastName", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'finance@hos.test',
  '<BCRYPT_HASH>',
  'Finance',
  'Manager',
  'FINANCE',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET 
  role = 'FINANCE',
  password = '<BCRYPT_HASH>',
  "updatedAt" = NOW();

-- Create CMS_EDITOR user
INSERT INTO users (id, email, password, "firstName", "lastName", role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'cms@hos.test',
  '<BCRYPT_HASH>',
  'CMS',
  'Editor',
  'CMS_EDITOR',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET 
  role = 'CMS_EDITOR',
  password = '<BCRYPT_HASH>',
  "updatedAt" = NOW();

-- Verify users created
SELECT email, role, "firstName", "lastName", "createdAt"
FROM users
WHERE email LIKE '%@hos.test'
ORDER BY role;

