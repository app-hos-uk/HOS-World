-- Update super admin user credentials
UPDATE users
SET 
  password = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  role = 'ADMIN',
  "firstName" = 'Super',
  "lastName" = 'Admin',
  "updatedAt" = NOW()
WHERE email = 'app@houseofspells.co.uk';
