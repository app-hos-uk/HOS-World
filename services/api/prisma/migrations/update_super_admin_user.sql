-- Update super admin user credentials
-- IMPORTANT: Generate a fresh bcrypt hash before running:
--   node -e "require('bcrypt').hash(process.env.SEED_ADMIN_PASSWORD, 12).then(h => console.log(h))"
-- Replace <GENERATED_BCRYPT_HASH> with the output.
UPDATE users
SET 
  password = '<GENERATED_BCRYPT_HASH>',
  role = 'ADMIN',
  "firstName" = 'Super',
  "lastName" = 'Admin',
  "updatedAt" = NOW()
WHERE email = 'app@houseofspells.co.uk';
