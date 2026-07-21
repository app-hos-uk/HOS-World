// ✅ CORRECTED Migration Script
// The token is stored as 'auth_token' in localStorage

const token = localStorage.getItem('auth_token');

if (!token) {
  console.error('❌ No token found. Please log in again.');
  console.log('💡 Checking all storage locations...');
  console.log('localStorage.auth_token:', localStorage.getItem('auth_token'));
  console.log('localStorage.token:', localStorage.getItem('token'));
  console.log('sessionStorage.auth_token:', sessionStorage.getItem('auth_token'));
  console.log('sessionStorage.token:', sessionStorage.getItem('token'));
} else {
  console.log('✅ Token found! Running migration...');
  console.log('🔑 Token (first 20 chars):', token.substring(0, 20) + '...');
  
  // IMPORTANT: Set this to your API URL before running in browser console
  const API_URL = prompt('Enter API URL (e.g. https://your-api.railway.app/api):', 'http://localhost:3001/api');
  if (!API_URL) { console.error('Aborted: no API URL provided'); return; }

  fetch(API_URL + '/admin/migration/run-global-features', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    console.log('📡 Response status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('✅ Migration Result:', data);
    if (data.success) {
      console.log('🎉 Migration completed successfully!');
      console.log(`✅ ${data.summary.successful} statements succeeded`);
      console.log(`⚠️ ${data.summary.errors} errors (may be expected for idempotent operations)`);
      if (data.verification) {
        console.log('🔍 Verification:', data.verification);
      }
      console.log('📋 Refresh the page to see changes');
    } else {
      console.error('❌ Migration failed:', data.error);
      console.error('Full error:', data);
    }
  })
  .catch(error => {
    console.error('❌ Network Error:', error);
    console.error('Error details:', error.message);
  });
}

