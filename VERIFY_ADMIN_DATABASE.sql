-- Verify Admin User in Database
-- Run this in VS Code PostgreSQL extension or Railway SQL console

-- Check 1: Verify user exists and get all details
SELECT 
  id,
  email,
  role,
  "firstName",
  "lastName",
  LEFT(password, 15) as password_start,
  LENGTH(password) as password_length,
  "createdAt",
  "updatedAt"
FROM users 
WHERE email = 'app@houseofspells.co.uk';

-- Check 2: Verify password hash format
SELECT 
  email,
  CASE 
    WHEN password LIKE '$2b$10$%' THEN '✅ Correct format'
    WHEN password LIKE 'b$10$%' THEN '❌ Missing $2 prefix'
    WHEN password LIKE '$b$10$%' THEN '❌ Missing 2'
    ELSE '❌ Unknown format'
  END as hash_format_check,
  LENGTH(password) as hash_length
FROM users 
WHERE email = 'app@houseofspells.co.uk';

-- Check 3: Full password hash (for verification)
SELECT 
  email,
  password as full_hash
FROM users 
WHERE email = 'app@houseofspells.co.uk';

-- If hash is wrong, run this UPDATE:
/*
UPDATE users
SET 
  password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  role = 'ADMIN',
  "firstName" = 'Super',
  "lastName" = 'Admin',
  "updatedAt" = NOW()
WHERE email = 'app@houseofspells.co.uk';
*/

