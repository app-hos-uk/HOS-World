/**
 * Verify a bcrypt hash against SEED_ADMIN_PASSWORD (dev utility).
 * Usage: SEED_ADMIN_PASSWORD='your-password' node VERIFY_PASSWORD_HASH.js [hash]
 */
const bcrypt = require('bcrypt');

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();
  if (!password) {
    console.error('Set SEED_ADMIN_PASSWORD env var to verify.');
    process.exit(1);
  }
  const hash = process.argv[2]?.trim();
  if (!hash) {
    console.error('Usage: SEED_ADMIN_PASSWORD=... node VERIFY_PASSWORD_HASH.js <bcrypt-hash>');
    process.exit(1);
  }
  const ok = await bcrypt.compare(password, hash);
  console.log(ok ? '✅ Password matches hash' : '❌ Password does not match hash');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
