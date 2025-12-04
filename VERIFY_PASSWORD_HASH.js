// Quick script to verify password hash
const bcrypt = require('bcrypt');

const password = 'Admin123';
const correctHash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

async function verify() {
  console.log('🔍 Verifying password hash...\n');
  console.log('Password:', password);
  console.log('Correct Hash:', correctHash);
  console.log('Hash Length:', correctHash.length, 'characters\n');
  
  const isValid = await bcrypt.compare(password, correctHash);
  console.log('✅ Hash verification:', isValid ? 'PASSED' : 'FAILED');
  
  if (isValid) {
    console.log('\n✅ The password hash is CORRECT!');
    console.log('If login still fails, check:');
    console.log('1. Did you save the changes in Railway?');
    console.log('2. Is the hash in database exactly this (no extra spaces)?');
    console.log('3. Wait a few seconds and try login again (cache might need to clear)');
  } else {
    console.log('\n❌ The password hash is INCORRECT!');
    console.log('Please update the password field in Railway with the hash above.');
  }
}

verify().catch(console.error);

